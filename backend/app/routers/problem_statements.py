import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.core import ProblemStatementVersion
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.context import gather_context

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

SYSTEM_PROMPT = """You are an expert product discovery coach using the CORE framework.
Your job is to synthesize all available context — transcript analyses, evidence,
sensemaking questions, and any prior problem statements — into a clear,
evidence-backed problem statement.

A strong problem statement answers:
- WHO is affected?
- WHAT do they need?
- WHY does the problem exist (root cause)?
- IMPACT: what happens if it's solved?

The output should be specific, grounded in evidence, and avoid solution-jumping.

Return JSON with this exact format:
{
  "who": "the specific user group or persona affected",
  "what": "what they need or the unmet need",
  "why": "root cause or systemic reason",
  "impact": "measurable outcome if solved",
  "statement": "A single-paragraph problem statement tying it all together"
}"""


class GenerateRequest(BaseModel):
    discovery_id: str
    user_instructions: str = ""


@router.get("/{discovery_id}", response_model=list[ProblemStatementVersion])
async def list_versions(discovery_id: str):
    storage = get_storage_provider()
    items = await storage.list("problem_statements", {"discoveryId": discovery_id})
    if not items:
        items = await storage.list("problem_statements", {"discovery_id": discovery_id})
    versions = [ProblemStatementVersion(**item) for item in items]
    versions.sort(key=lambda v: v.version)
    return versions


@router.post("/generate", response_model=ProblemStatementVersion)
async def generate_problem_statement(request: GenerateRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    context = await gather_context(request.discovery_id)
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No context available. Add evidence, transcripts, or questions first.",
        )

    # Determine version number
    existing = await storage.list("problem_statements", {"discoveryId": request.discovery_id})
    if not existing:
        existing = await storage.list("problem_statements", {"discovery_id": request.discovery_id})
    next_version = len(existing) + 1

    user_block = ""
    if request.user_instructions:
        user_block = f"\n\nUser instructions for this version:\n{request.user_instructions}"

    user_prompt = f"""Here is everything we know about this discovery:

{context}{user_block}

Synthesize a problem statement (version {next_version}).
Return JSON with: who, what, why, impact, statement."""

    try:
        result = await llm.complete_json(SYSTEM_PROMPT, user_prompt)
    except Exception:
        logger.exception("LLM call failed for problem statement generation")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    version = ProblemStatementVersion(
        discovery_id=request.discovery_id,
        version=next_version,
        who=result.get("who", ""),
        what=result.get("what", ""),
        why=result.get("why", ""),
        impact=result.get("impact", ""),
        statement=result.get("statement", ""),
        user_instructions=request.user_instructions,
        context_used=context[:2000],
    )

    try:
        saved = await storage.create("problem_statements", version.model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to save problem statement version")
        raise HTTPException(status_code=500, detail="Failed to save problem statement")

    # Also update the discovery's problem_statement field
    try:
        await storage.update(
            "discoveries",
            request.discovery_id,
            {
                "problem_statement": {
                    "who": version.who,
                    "what": version.what,
                    "why": version.why,
                    "impact": version.impact,
                    "statement": version.statement,
                    "confidence": "assumed",
                }
            },
        )
    except Exception:
        logger.debug("Could not update discovery problem_statement")

    return ProblemStatementVersion(**saved)
