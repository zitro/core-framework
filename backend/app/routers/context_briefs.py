import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.core import ContextBriefVersion
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create
from app.utils.context import gather_context

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

SYSTEM_PROMPT = """You are an expert product discovery partner using the CORE framework.
Create a concise project context brief from all available discovery data.
The brief should be useful for a human to review, challenge, and refine in Orchestrate.
Do not invent facts. Separate known context from risks and open questions.

Return JSON with this exact shape:
{
  "title": "short project/context title",
  "summary": "2-4 sentence synthesis of what is known so far",
  "goals": ["known or inferred goal"],
  "stakeholders": ["stakeholder group or role"],
  "constraints": ["constraint, dependency, governance issue, data issue, or environment reality"],
  "risks": ["risk or concern"],
  "open_questions": ["question the team should answer"],
  "evidence_summary": "brief explanation of the evidence base used"
}"""


class GenerateRequest(BaseModel):
    discovery_id: str
    user_instructions: str = ""
    working_context: str = ""
    force: bool = False


def _fingerprint(context: str) -> str:
    return hashlib.sha256(context.encode("utf-8")).hexdigest()


async def _load_versions(discovery_id: str) -> list[ContextBriefVersion]:
    storage = get_storage_provider()
    items = await storage.list("context_briefs", {"discoveryId": discovery_id})
    if not items:
        items = await storage.list("context_briefs", {"discovery_id": discovery_id})
    versions = [ContextBriefVersion(**item) for item in items]
    versions.sort(key=lambda version: version.version)
    return versions


@router.get("/{discovery_id}", response_model=list[ContextBriefVersion])
async def list_versions(discovery_id: str):
    return await _load_versions(discovery_id)


@router.post("/generate", response_model=ContextBriefVersion)
async def generate_context_brief(request: GenerateRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    gathered_context = await gather_context(request.discovery_id)
    working_context = request.working_context.strip()
    context = "\n\n".join(
        part
        for part in [gathered_context.strip(), f"Orchestrate working material:\n{working_context}" if working_context else ""]
        if part
    )
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No context available. Add sources, notes, transcripts, or evidence first.",
        )

    existing = await _load_versions(request.discovery_id)
    context_fingerprint = _fingerprint(context)
    latest = existing[-1] if existing else None
    if (
        latest
        and latest.context_fingerprint == context_fingerprint
        and not request.force
        and not request.user_instructions.strip()
    ):
        return latest

    next_version = len(existing) + 1
    user_block = ""
    if request.user_instructions.strip():
        user_block = f"\n\nHuman review instructions for this version:\n{request.user_instructions.strip()}"

    user_prompt = f"""Here is the latest discovery context:

{context}{user_block}

Generate project context brief version {next_version}."""

    try:
        result = await llm.complete_json(SYSTEM_PROMPT, user_prompt, max_tokens=2500)
    except Exception:
        logger.exception("LLM call failed for context brief generation")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    version = ContextBriefVersion(
        discovery_id=request.discovery_id,
        version=next_version,
        title=result.get("title", ""),
        summary=result.get("summary", ""),
        goals=result.get("goals", []) or [],
        stakeholders=result.get("stakeholders", []) or [],
        constraints=result.get("constraints", []) or [],
        risks=result.get("risks", []) or [],
        open_questions=result.get("open_questions", []) or [],
        evidence_summary=result.get("evidence_summary", ""),
        user_instructions=request.user_instructions,
        context_used=context[:3000],
        context_fingerprint=context_fingerprint,
    )

    try:
        saved = await storage.create("context_briefs", stamp_create(version.model_dump(mode="json")))
    except Exception:
        logger.exception("Failed to save context brief version")
        raise HTTPException(status_code=500, detail="Failed to save context brief")

    return ContextBriefVersion(**saved)
