from fastapi import APIRouter
from pydantic import BaseModel

from app.models.core import CorePhase, QuestionSet
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider

router = APIRouter()

PHASE_PROMPTS = {
    CorePhase.CAPTURE: """You are a product discovery coach using the CORE framework (Capture phase).
Generate discovery questions that help the team:
- Map the stakeholder ecosystem
- Understand current workflows and pain points
- Gather raw evidence before forming opinions
- Identify who is affected and how
Focus on LISTENING and PROBING. Avoid leading questions.""",
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
    CorePhase.EXECUTE: """You are a product discovery coach using the CORE framework (Execute phase).
Generate execution planning questions that help the team:
- Identify the ONE quick win that delivers immediate value
- Plan the blocker remediation roadmap
- Define success metrics for the quick win
- Prepare the RPI handoff (Research → Plan → Implement)
Focus on DELIVERING and MOBILIZING.""",
}


class QuestionRequest(BaseModel):
    discovery_id: str
    phase: CorePhase
    context: str = ""
    num_questions: int = 8


@router.post("/generate", response_model=QuestionSet)
async def generate_questions(request: QuestionRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    system_prompt = PHASE_PROMPTS[request.phase]
    user_prompt = f"""Context about this discovery engagement:
{request.context}

Generate {request.num_questions} questions for the {request.phase.value} phase.
Return JSON with format: {{"questions": [{{"text": "...", "purpose": "...", "follow_ups": ["..."]}}]}}"""

    result = await llm.complete_json(system_prompt, user_prompt)

    question_set = QuestionSet(
        discovery_id=request.discovery_id,
        phase=request.phase,
        context=request.context,
        questions=result.get("questions", []),
    )

    saved = await storage.create("question_sets", question_set.model_dump(mode="json"))
    return QuestionSet(**saved)
