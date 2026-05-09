"""Execute output router — persisted final artifacts generated from discovery context."""

from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.models.core import ExecuteOutputVersion
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create
from app.utils.context import gather_context
from app.utils.review_gate import auto_request_review

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

Audience = Literal["executive", "technical", "customer", "internal"]
Style = Literal["narrative", "brief", "outline"]
Category = Literal["stakeholder", "delivery", "technical"]


class ExecuteOutputDefinition(BaseModel):
    id: str
    title: str
    description: str
    audience: Audience
    style: Style
    focus: str
    category: Category


class ExecuteOutputGenerateRequest(BaseModel):
    discovery_id: str = Field(min_length=1)
    output_id: str = Field(min_length=1)
    force: bool = False


class ExecuteOutputEnsureRequest(BaseModel):
    discovery_id: str = Field(min_length=1)
    output_ids: list[str] = Field(default_factory=list)
    force: bool = False


OUTPUT_DEFINITIONS: list[ExecuteOutputDefinition] = [
    ExecuteOutputDefinition(
        id="executive-brief",
        title="Executive Decision Brief",
        description="Decision-ready summary with recommendation, evidence, risks, and asks.",
        audience="executive",
        style="brief",
        focus="Create a final executive decision brief for sponsors. Include the recommendation, why now, evidence, risks, decisions needed, and next steps.",
        category="stakeholder",
    ),
    ExecuteOutputDefinition(
        id="customer-summary",
        title="Customer Summary Update",
        description="Customer-facing recap that confirms what was heard and what happens next.",
        audience="customer",
        style="brief",
        focus="Create a customer-facing discovery summary update. Reflect the customer's language, summarize what we heard, what we recommend, open questions, and next actions.",
        category="stakeholder",
    ),
    ExecuteOutputDefinition(
        id="weekly-update",
        title="Weekly Update Email",
        description="Copy-ready weekly update with progress, decisions, blockers, and next week plan.",
        audience="internal",
        style="brief",
        focus="Create a weekly status email. Include progress this week, key decisions, blockers, risks, asks, and next week priorities.",
        category="delivery",
    ),
    ExecuteOutputDefinition(
        id="deck-outline",
        title="Stakeholder Deck Outline",
        description="Slide-by-slide storyline for the final presentation package.",
        audience="executive",
        style="outline",
        focus="Create a stakeholder deck outline. Include slide titles, slide purpose, key message, and the evidence or artifact each slide should reference.",
        category="stakeholder",
    ),
    ExecuteOutputDefinition(
        id="technical-handoff",
        title="Technical Handoff Brief",
        description="Build-team handoff with architecture, dependencies, risks, and open decisions.",
        audience="technical",
        style="outline",
        focus="Create a technical handoff brief for implementation leads. Include architecture direction, integration points, dependencies, validation gaps, risks, and immediate engineering work items.",
        category="technical",
    ),
]

_OUTPUT_BY_ID = {definition.id: definition for definition in OUTPUT_DEFINITIONS}

_AUDIENCE_GUIDE = {
    "executive": (
        "Audience: senior executives. Lead with business outcomes, decisions required, "
        "material risks, and the recommendation. Avoid jargon."
    ),
    "technical": (
        "Audience: implementation and architecture leads. Surface architecture direction, "
        "technical constraints, dependencies, integration risks, and open decisions."
    ),
    "customer": (
        "Audience: the customer team. Reflect their language, validate what was heard, "
        "and make next steps clear without overclaiming."
    ),
    "internal": (
        "Audience: the delivery team. Be candid about progress, risks, blockers, owners, "
        "and what needs attention next."
    ),
}

_STYLE_GUIDE = {
    "narrative": "Write in flowing prose. 3-5 sections, each 1-2 paragraphs.",
    "brief": "Tight brief. Headline + concise bullets or short paragraphs per section.",
    "outline": "Structured outline with clear headings and bullets. No long prose.",
}


def _fingerprint(context: str) -> str:
    return hashlib.sha256(context.encode("utf-8")).hexdigest()


async def _load_outputs(discovery_id: str) -> list[ExecuteOutputVersion]:
    storage = get_storage_provider()
    items = await storage.list("execute_outputs", {"discoveryId": discovery_id})
    if not items:
        items = await storage.list("execute_outputs", {"discovery_id": discovery_id})
    outputs = [ExecuteOutputVersion(**item) for item in items]
    outputs.sort(key=lambda item: (item.output_id, item.version, item.created_at))
    return outputs


def _latest_by_output(outputs: list[ExecuteOutputVersion]) -> dict[str, ExecuteOutputVersion]:
    latest: dict[str, ExecuteOutputVersion] = {}
    for output in outputs:
        current = latest.get(output.output_id)
        if current is None or output.version >= current.version:
            latest[output.output_id] = output
    return latest


def _build_system_prompt(definition: ExecuteOutputDefinition) -> str:
    return (
        "You are the CORE Execute artifact generator. Create final, stakeholder-ready "
        "delivery material from the complete discovery record across Capture, Orchestrate, "
        "Refine, and Execute. Use only supplied context; do not invent facts. If evidence is "
        "missing, say what is not yet supported.\n\n"
        f"Artifact: {definition.title}\n"
        f"{_AUDIENCE_GUIDE[definition.audience]}\n"
        f"{_STYLE_GUIDE[definition.style]}\n\n"
        "Return JSON with this exact shape:\n"
        "{\n"
        '  "headline": "single-sentence framing",\n'
        '  "summary": "2-3 sentence summary",\n'
        '  "sections": [{"title": "...", "body": "..."}]\n'
        "}\n"
    )


def _normalize_sections(raw_sections: object) -> list[dict[str, str]]:
    if not isinstance(raw_sections, list):
        return []
    sections: list[dict[str, str]] = []
    for section in raw_sections:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title", "")).strip()
        body = str(section.get("body", "")).strip()
        if title or body:
            sections.append({"title": title or "Section", "body": body})
    return sections


async def _execute_context(discovery_id: str) -> str:
    storage = get_storage_provider()
    parts = [await gather_context(discovery_id)]

    for collection, label in [
        ("context_briefs", "Project understanding"),
        ("problem_statements", "Problem statement versions"),
        ("use_cases", "Use case versions"),
        ("solution_blueprints", "Solution blueprint versions"),
        ("execute_outputs", "Prior Execute outputs"),
    ]:
        try:
            items = await storage.list(collection, {"discoveryId": discovery_id})
            if not items:
                items = await storage.list(collection, {"discovery_id": discovery_id})
            if items:
                recent = items[-3:] if collection != "execute_outputs" else []
                if recent:
                    parts.append(f"{label}:\n" + "\n".join(str(item) for item in recent))
        except Exception:
            logger.debug("Could not load %s for execute context", collection)

    return "\n\n".join(part for part in parts if part and part.strip())


async def _generate_output(
    discovery_id: str,
    definition: ExecuteOutputDefinition,
    context: str,
    context_fingerprint: str,
) -> ExecuteOutputVersion:
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No context available. Complete Capture, Orchestrate, or Refine before generating Execute outputs.",
        )

    storage = get_storage_provider()
    existing = [item for item in await _load_outputs(discovery_id) if item.output_id == definition.id]
    next_version = len(existing) + 1

    user_prompt = (
        f"Complete discovery context:\n\n{context}\n\n"
        f"Generate {definition.title} version {next_version}.\n"
        f"Specific artifact focus: {definition.focus}"
    )

    try:
        result = await get_llm_provider().complete_json(
            _build_system_prompt(definition),
            user_prompt,
            max_tokens=2800,
        )
    except Exception:
        logger.exception("LLM call failed for execute output %s", definition.id)
        raise HTTPException(status_code=502, detail="AI service unavailable")

    output = ExecuteOutputVersion(
        discovery_id=discovery_id,
        output_id=definition.id,
        title=definition.title,
        description=definition.description,
        audience=definition.audience,
        style=definition.style,
        category=definition.category,
        version=next_version,
        headline=str(result.get("headline", "")).strip(),
        summary=str(result.get("summary", "")).strip(),
        sections=_normalize_sections(result.get("sections")),
        focus=definition.focus,
        context_fingerprint=context_fingerprint,
        context_used=context[:4000],
    )

    try:
        saved = await storage.create("execute_outputs", stamp_create(output.model_dump(mode="json")))
    except Exception:
        logger.exception("Failed to save execute output %s", definition.id)
        raise HTTPException(status_code=500, detail="Failed to save Execute output")

    await auto_request_review(
        artifact_collection="execute_outputs",
        artifact_id=str(saved.get("id", "")),
        artifact_title=f"{definition.title} v{next_version}",
        discovery_id=discovery_id,
    )

    return ExecuteOutputVersion(**saved)


@router.get("/definitions", response_model=list[ExecuteOutputDefinition])
async def list_execute_output_definitions():
    return OUTPUT_DEFINITIONS


@router.get("/{discovery_id}", response_model=list[ExecuteOutputVersion])
async def list_execute_outputs(discovery_id: str):
    return await _load_outputs(discovery_id)


@router.post("/generate", response_model=ExecuteOutputVersion)
async def generate_execute_output(request: ExecuteOutputGenerateRequest):
    definition = _OUTPUT_BY_ID.get(request.output_id)
    if definition is None:
        raise HTTPException(status_code=400, detail=f"Unknown Execute output: {request.output_id}")

    context = await _execute_context(request.discovery_id)
    context_fingerprint = _fingerprint(context)
    latest = _latest_by_output(await _load_outputs(request.discovery_id)).get(request.output_id)
    if latest and latest.context_fingerprint == context_fingerprint and not request.force:
        return latest

    return await _generate_output(request.discovery_id, definition, context, context_fingerprint)


@router.post("/ensure", response_model=list[ExecuteOutputVersion])
async def ensure_execute_outputs(request: ExecuteOutputEnsureRequest):
    requested_ids = request.output_ids or [definition.id for definition in OUTPUT_DEFINITIONS]
    unknown = [output_id for output_id in requested_ids if output_id not in _OUTPUT_BY_ID]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown Execute outputs: {', '.join(unknown)}")

    context = await _execute_context(request.discovery_id)
    context_fingerprint = _fingerprint(context)
    existing = await _load_outputs(request.discovery_id)
    latest = _latest_by_output(existing)
    ensured_by_id: dict[str, ExecuteOutputVersion] = {}
    generation_tasks: list[tuple[str, asyncio.Task[ExecuteOutputVersion]]] = []

    for output_id in requested_ids:
        current = latest.get(output_id)
        if current and current.context_fingerprint == context_fingerprint and not request.force:
            ensured_by_id[output_id] = current
            continue
        generation_tasks.append(
            (
                output_id,
                asyncio.create_task(_generate_output(
                    request.discovery_id,
                    _OUTPUT_BY_ID[output_id],
                    context,
                    context_fingerprint,
                )),
            )
        )

    for output_id, task in generation_tasks:
        ensured_by_id[output_id] = await task

    ensured = [
        ensured_by_id[output_id]
        for output_id in requested_ids
        if output_id in ensured_by_id
    ]
    ensured.sort(key=lambda item: requested_ids.index(item.output_id))
    return ensured
