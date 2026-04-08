import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.models.core import CorePhase, Question, QuestionSet
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

PHASE_PROMPTS = {
    CorePhase.CAPTURE: (
        """You are a product discovery coach using the CORE framework"""
        """ (Capture phase).
Generate discovery questions that help the team:
- Map the stakeholder ecosystem
- Understand current workflows and pain points
- Gather raw evidence before forming opinions
- Identify who is affected and how
Focus on LISTENING and PROBING. Avoid leading questions."""
    ),
    CorePhase.ORIENT: """You are a product discovery coach using the CORE framework (Orient phase).
Generate sensemaking questions that help the team:
- Recognize patterns across the evidence collected
- Frame the real problem (not just symptoms)
- Build systems maps of cause and effect
- Challenge assumptions with "what if we're wrong about..."
Focus on PATTERN RECOGNITION and FRAMING.""",
    CorePhase.REFINE: """You are a product discovery coach using the CORE framework (Refine phase).
Generate solution exploration questions that help the team:
- Imagine multiple solution approaches
- Test assumptions cheaply before building
- Evaluate solutions against real evidence
- Match problems to existing capabilities (Solution Matcher)
Focus on VALIDATING and SIMULATING.""",
    CorePhase.EXECUTE: (
        """You are a product discovery coach using the CORE framework"""
        """ (Execute phase).
Generate execution planning questions that help the team:
- Identify the ONE quick win that delivers immediate value
- Plan the blocker remediation roadmap
- Define success metrics for the quick win
- Prepare the RPI handoff (Research → Plan → Implement)
Focus on DELIVERING and MOBILIZING."""
    ),
}


class QuestionRequest(BaseModel):
    discovery_id: str
    phase: CorePhase
    context: str = ""
    num_questions: int = Field(default=8, ge=1, le=20)


@router.post("/generate", response_model=QuestionSet)
async def generate_questions(request: QuestionRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    system_prompt = PHASE_PROMPTS[request.phase]
    user_prompt = f"""Context about this discovery engagement:
{request.context}

Generate {request.num_questions} questions for the {request.phase.value} phase.
Return JSON with format:
{{"questions": [{{"text": "...", "purpose": "...", "follow_ups": ["..."]}}]}}"""

    try:
        result = await llm.complete_json(system_prompt, user_prompt)
    except Exception:
        logger.exception("LLM call failed for question generation")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    raw_questions = result.get("questions", [])
    questions = [
        Question(
            text=q.get("text", ""),
            purpose=q.get("purpose", ""),
            follow_ups=q.get("follow_ups", []),
        )
        for q in raw_questions
        if q.get("text")
    ]

    question_set = QuestionSet(
        discovery_id=request.discovery_id,
        phase=request.phase,
        context=request.context,
        questions=questions,
    )

    saved = await storage.create("question_sets", question_set.model_dump(mode="json"))
    return QuestionSet(**saved)


class SolutionMatchRequest(BaseModel):
    discovery_id: str
    problem: str
    capabilities: list[str] = Field(default_factory=list)


class SolutionMatch(BaseModel):
    problem: str
    capabilities: list[str] = Field(default_factory=list)
    gap: str = ""
    confidence: int = Field(default=50, ge=0, le=100)


class SolutionMatchResult(BaseModel):
    matches: list[SolutionMatch] = Field(default_factory=list)


@router.post("/solution-match", response_model=SolutionMatchResult)
async def solution_match(request: SolutionMatchRequest):
    llm = get_llm_provider()

    system_prompt = (
        "You are a product discovery coach using the CORE framework"
        " (Refine phase, Solution Matcher).\n"
        "Given a problem and a list of known capabilities, analyze"
        " which capabilities address the problem, identify gaps,"
        " and estimate confidence (0-100)."
    )
    caps = ", ".join(request.capabilities) if request.capabilities else "none listed"
    user_prompt = (
        f"Problem: {request.problem}\n"
        f"Known capabilities: {caps}\n\n"
        "Return JSON with format:\n"
        '{"matches": [{"problem": "...", "capabilities": ["..."],'
        ' "gap": "...", "confidence": 50}]}'
    )

    try:
        result = await llm.complete_json(system_prompt, user_prompt)
    except Exception:
        logger.exception("LLM call failed for solution matching")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    raw_matches = result.get("matches", [])
    matches = []
    for m in raw_matches:
        try:
            matches.append(
                SolutionMatch(
                    problem=m.get("problem", request.problem),
                    capabilities=m.get("capabilities", []),
                    gap=m.get("gap", ""),
                    confidence=max(0, min(100, int(m.get("confidence", 50)))),
                )
            )
        except (ValueError, TypeError):
            continue

    return SolutionMatchResult(matches=matches)
