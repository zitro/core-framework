"""AI Advisor router — generates use cases and solution blueprints."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.core import UseCaseVersion
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create
from app.utils.context import gather_context
from app.utils.review_gate import auto_request_review

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

# ── Use Case Generation ──────────────────────────────────

USE_CASE_SYSTEM = """You are an expert product discovery consultant.
Synthesize all available context into a structured use case with
clear business value and measurable impact.

Return JSON with this exact format:
{
  "title": "concise use case title",
  "persona": "who is the primary user/beneficiary",
  "goal": "what they are trying to achieve",
  "current_state": "how they do it today and what is broken",
  "desired_state": "what the ideal outcome looks like",
  "business_value": "qualitative value proposition (1-2 sentences)",
  "business_impact": "quantitative or measurable impact statement",
  "success_metrics": ["metric 1", "metric 2", "metric 3"],
  "summary": "2-3 paragraph narrative tying everything together"
}"""


class UseCaseRequest(BaseModel):
    discovery_id: str
    user_instructions: str = ""


@router.get(
    "/use-cases/{discovery_id}",
    response_model=list[UseCaseVersion],
)
async def list_use_cases(discovery_id: str):
    storage = get_storage_provider()
    items = await storage.list("use_cases", {"discoveryId": discovery_id})
    if not items:
        items = await storage.list("use_cases", {"discovery_id": discovery_id})
    versions = [UseCaseVersion(**item) for item in items]
    versions.sort(key=lambda v: v.version)
    return versions


@router.post("/use-cases/generate", response_model=UseCaseVersion)
async def generate_use_case(request: UseCaseRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    context = await gather_context(request.discovery_id)
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No context yet. Add evidence or transcripts first.",
        )

    existing = await storage.list("use_cases", {"discoveryId": request.discovery_id})
    if not existing:
        existing = await storage.list("use_cases", {"discovery_id": request.discovery_id})
    next_version = len(existing) + 1

    user_block = ""
    if request.user_instructions:
        user_block = f"\n\nUser guidance for this version:\n{request.user_instructions}"

    user_prompt = (
        f"Here is everything we know about this discovery:\n\n"
        f"{context}{user_block}\n\n"
        f"Synthesize a use case (version {next_version}).\n"
        f"Return JSON with: title, persona, goal, current_state, "
        f"desired_state, business_value, business_impact, "
        f"success_metrics, summary."
    )

    try:
        result = await llm.complete_json(USE_CASE_SYSTEM, user_prompt)
    except Exception:
        logger.exception("LLM call failed for use case generation")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    version = UseCaseVersion(
        discovery_id=request.discovery_id,
        version=next_version,
        title=result.get("title", ""),
        persona=result.get("persona", ""),
        goal=result.get("goal", ""),
        current_state=result.get("current_state", ""),
        desired_state=result.get("desired_state", ""),
        business_value=result.get("business_value", ""),
        business_impact=result.get("business_impact", ""),
        success_metrics=result.get("success_metrics", []),
        summary=result.get("summary", ""),
        user_instructions=request.user_instructions,
        context_used=context[:2000],
    )

    try:
        saved = await storage.create("use_cases", stamp_create(version.model_dump(mode="json")))
    except Exception:
        logger.exception("Failed to save use case version")
        raise HTTPException(status_code=500, detail="Failed to save")

    await auto_request_review(
        artifact_collection="use_cases",
        artifact_id=str(saved.get("id", "")),
        artifact_title=saved.get("title", "")[:120],
        discovery_id=request.discovery_id,
    )

    return UseCaseVersion(**saved)
