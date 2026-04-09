"""Solution Blueprint router — AI-generated architecture proposals."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.core import SolutionBlueprint
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.context import gather_context, get_solution_providers

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

BLUEPRINT_SYSTEM = """You are a senior solutions architect.
Given a customer's discovery context, propose a concrete solution
approach using the specified technology providers.

Think about:
- What services/products solve each part of the problem
- A high-level architecture overview
- A quick-win the customer can see working in 1-2 weeks
- Open questions that still need answers
- Follow-up questions to ask the customer for clarity

Return JSON with this exact format:
{
  "approach_title": "short title for this solution approach",
  "approach_summary": "2-3 paragraph description of the approach",
  "services": [
    {"service": "Service Name", "purpose": "what it solves",
     "rationale": "why this over alternatives"}
  ],
  "architecture_overview": "text description of how pieces connect",
  "quick_win_suggestion": "what can be demo'd in 1-2 weeks",
  "estimated_effort": "rough T-shirt size and timeline",
  "open_questions": ["question about unknowns"],
  "follow_up_questions": ["question to ask the customer next"]
}"""


class BlueprintRequest(BaseModel):
    discovery_id: str
    user_instructions: str = ""


@router.get(
    "/{discovery_id}",
    response_model=list[SolutionBlueprint],
)
async def list_blueprints(discovery_id: str):
    storage = get_storage_provider()
    items = await storage.list(
        "solution_blueprints", {"discoveryId": discovery_id}
    )
    if not items:
        items = await storage.list(
            "solution_blueprints", {"discovery_id": discovery_id}
        )
    versions = [SolutionBlueprint(**item) for item in items]
    versions.sort(key=lambda v: v.version)
    return versions


@router.post("/generate", response_model=SolutionBlueprint)
async def generate_blueprint(request: BlueprintRequest):
    llm = get_llm_provider()
    storage = get_storage_provider()

    context = await gather_context(request.discovery_id)
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No context yet. Add evidence or transcripts first.",
        )

    providers = await get_solution_providers(request.discovery_id)
    provider_str = ", ".join(providers)

    existing = await storage.list(
        "solution_blueprints", {"discoveryId": request.discovery_id}
    )
    if not existing:
        existing = await storage.list(
            "solution_blueprints",
            {"discovery_id": request.discovery_id},
        )
    next_version = len(existing) + 1

    user_block = ""
    if request.user_instructions:
        user_block = (
            f"\n\nUser guidance for this version:\n"
            f"{request.user_instructions}"
        )

    user_prompt = (
        f"Discovery context:\n\n{context}{user_block}\n\n"
        f"Target technology providers: {provider_str}\n"
        f"Propose services and architecture ONLY from these providers.\n\n"
        f"Generate solution blueprint version {next_version}."
    )

    try:
        result = await llm.complete_json(BLUEPRINT_SYSTEM, user_prompt)
    except Exception:
        logger.exception("LLM call failed for blueprint generation")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    blueprint = SolutionBlueprint(
        discovery_id=request.discovery_id,
        version=next_version,
        approach_title=result.get("approach_title", ""),
        approach_summary=result.get("approach_summary", ""),
        services=[
            {"service": s.get("service", ""), "purpose": s.get("purpose", ""),
             "rationale": s.get("rationale", "")}
            for s in result.get("services", [])
        ],
        architecture_overview=result.get("architecture_overview", ""),
        quick_win_suggestion=result.get("quick_win_suggestion", ""),
        estimated_effort=result.get("estimated_effort", ""),
        open_questions=result.get("open_questions", []),
        follow_up_questions=result.get("follow_up_questions", []),
        target_providers=providers,
        user_instructions=request.user_instructions,
        context_used=context[:2000],
    )

    try:
        saved = await storage.create(
            "solution_blueprints", blueprint.model_dump(mode="json")
        )
    except Exception:
        logger.exception("Failed to save solution blueprint")
        raise HTTPException(status_code=500, detail="Failed to save")

    return SolutionBlueprint(**saved)
