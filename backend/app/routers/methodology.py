"""Discovery-scoped methodology template artifacts (multi-instance).

Each filled template instance — Empathy Map · Ops manager, Persona ·
Pricing analyst, Journey Map · Renewal flow, etc. — is one record here
and is folded into LLM prompts via
:func:`app.utils.methodology.render_methodology_block`.

Instances can be user-created or auto-generated from the discovery
corpus. Both share the same store, so the Methodology page and the
Orchestrate "Personas" surface read and write the same data.

Routes (mounted at ``/api/methodology``):
  GET    /?discovery_id=...&method_id=...     list (optionally filtered)
  POST   /                                    create instance
  PATCH  /{artifact_id}                       update instance
  DELETE /{artifact_id}                       remove instance
  POST   /{method_id}/generate                auto-generate from corpus
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.audit import current_user, stamp_create, stamp_update, user_label
from app.utils.context import gather_context

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

COLLECTION = "methodology_artifacts"

ArtifactSource = Literal["user", "auto"]

AUTOGEN_FIELDS: dict[str, list[str]] = {
    "empathy-map": ["says", "thinks", "does", "feels"],
    "persona": ["name", "goals", "frustrations", "a-day-in-the-life", "tools"],
    "journey-map": ["stages", "actions", "pain-points", "opportunities"],
    "hmw-board": ["pain", "reframe", "hmw"],
    "champion-map": [
        "champion",
        "their-goal",
        "what-blocks-them",
        "what-we-offer",
        "blockers-to-yes",
    ],
}

AUTOGEN_GUIDE: dict[str, str] = {
    "empathy-map": (
        "An Empathy Map captures what one user segment SAYS, THINKS, DOES, FEELS. "
        "`says` should be direct quotes when available. `thinks` are inferences "
        "grounded in evidence. `does` is observed behavior. `feels` is emotional "
        "state with the trigger that caused it."
    ),
    "persona": (
        "A Persona is a grounded archetype of one user group. `name` should be "
        "'<First name>, <role>'. `goals` is what they're trying to accomplish in "
        "their week. `frustrations` is what's blocking them today. "
        "`a-day-in-the-life` describes how a typical day flows. `tools` is the "
        "systems/spreadsheets/comms channels they live in. Each must trace back "
        "to source material — no clip-art personas."
    ),
    "journey-map": (
        "A Journey Map traces one persona's experience across stages. `stages` "
        "lists the stages newline-separated. `actions` is what they do at each "
        "stage. `pain-points` is where it breaks down. `opportunities` is where "
        "CORE could change the shape of the journey."
    ),
    "hmw-board": (
        "Each HMW row reframes a pain into an optimistic, solvable invitation. "
        "`pain` is the raw observation. `reframe` is a neutral problem statement. "
        "`hmw` follows the form 'How might we [verb] [user] so they can [outcome]?'"
    ),
    "champion-map": (
        "A Champion Map names a stakeholder whose 'yes' matters. `champion` is "
        "name + role + why they care. `their-goal` is what success looks like "
        "from their seat. `what-blocks-them` is organizational/technical/political "
        "constraints. `what-we-offer` is the smallest move that makes them "
        "visibly successful. `blockers-to-yes` lists who else must sign off."
    ),
}


class MethodologyArtifact(BaseModel):
    id: str
    project_id: str = ""
    discovery_id: str
    method_id: str
    instance_id: str
    title: str = ""
    fields: dict[str, str] = Field(default_factory=dict)
    source: ArtifactSource = "user"
    author: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ArtifactCreate(BaseModel):
    discovery_id: str
    method_id: str
    title: str = ""
    fields: dict[str, str] = Field(default_factory=dict)
    source: ArtifactSource = "user"


class ArtifactUpdate(BaseModel):
    title: str | None = None
    fields: dict[str, str] | None = None


class GenerateRequest(BaseModel):
    discovery_id: str
    count: int = Field(default=3, ge=1, le=6)
    replace: bool = False


def _clean_fields(fields: dict[str, str]) -> dict[str, str]:
    return {k: (v or "").strip() for k, v in fields.items()}


@router.get("", response_model=list[MethodologyArtifact])
async def list_artifacts(
    discovery_id: str = Query(...),
    method_id: str | None = Query(None),
) -> list[MethodologyArtifact]:
    storage = get_storage_provider()
    query: dict = {"discovery_id": discovery_id}
    if method_id:
        query["method_id"] = method_id
    rows = await storage.list(COLLECTION, query)
    rows.sort(key=lambda r: r.get("created_at", ""))
    return [MethodologyArtifact(**r) for r in rows]


@router.post("", response_model=MethodologyArtifact)
async def create_artifact(payload: ArtifactCreate) -> MethodologyArtifact:
    storage = get_storage_provider()
    record = MethodologyArtifact(
        id=str(uuid.uuid4()),
        discovery_id=payload.discovery_id,
        method_id=payload.method_id,
        instance_id=str(uuid.uuid4()),
        title=payload.title.strip(),
        fields=_clean_fields(payload.fields),
        source=payload.source,
        author=user_label(current_user.get()),
    ).model_dump(mode="json")
    stamp_create(record)
    saved = await storage.create(COLLECTION, record)
    return MethodologyArtifact(**saved)


@router.patch("/{artifact_id}", response_model=MethodologyArtifact)
async def update_artifact(artifact_id: str, payload: ArtifactUpdate) -> MethodologyArtifact:
    storage = get_storage_provider()
    existing = await storage.get(COLLECTION, artifact_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template instance not found")
    if payload.title is not None:
        existing["title"] = payload.title.strip()
    if payload.fields is not None:
        existing["fields"] = _clean_fields(payload.fields)
    stamp_update(existing)
    saved = await storage.update(COLLECTION, artifact_id, existing)
    return MethodologyArtifact(**saved)


@router.delete("/{artifact_id}")
async def delete_artifact(artifact_id: str) -> dict:
    storage = get_storage_provider()
    existing = await storage.get(COLLECTION, artifact_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template instance not found")
    await storage.delete(COLLECTION, artifact_id)
    return {"deleted": True, "id": artifact_id}


@router.post("/{method_id}/generate", response_model=list[MethodologyArtifact])
async def generate_artifacts(method_id: str, payload: GenerateRequest) -> list[MethodologyArtifact]:
    if method_id not in AUTOGEN_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Auto-generation is not supported for method '{method_id}'",
        )

    storage = get_storage_provider()
    if payload.replace:
        existing = await storage.list(
            COLLECTION,
            {"discovery_id": payload.discovery_id, "method_id": method_id, "source": "auto"},
        )
        for row in existing:
            try:
                await storage.delete(COLLECTION, row["id"])
            except Exception:
                logger.warning("methodology: failed to delete %s", row.get("id"))

    corpus = await gather_context(payload.discovery_id)
    if not corpus or len(corpus) < 80:
        raise HTTPException(
            status_code=400,
            detail=(
                "Not enough discovery content yet — capture some evidence, "
                "transcripts, or context first."
            ),
        )

    fields = AUTOGEN_FIELDS[method_id]
    guide = AUTOGEN_GUIDE[method_id]

    system_prompt = (
        "You generate methodology artifacts grounded in a customer-discovery "
        "corpus. Output strict JSON only — no prose, no markdown.\n\n"
        f"{guide}\n\n"
        f"Produce up to {payload.count} distinct instances. Each instance "
        "must be substantive and trace back to the corpus. If the corpus does "
        "not support a field, leave it as an empty string — do not invent."
    )
    field_schema = ", ".join(f'"{f}": string' for f in fields)
    user_prompt = (
        f"Discovery corpus:\n{corpus}\n\n"
        f"Return JSON of the form:\n"
        f'{{\n  "instances": [\n    {{ "title": string (short label), '
        f"{field_schema} }}\n  ]\n}}\n\n"
        f"Return between 1 and {payload.count} instances."
    )

    llm = get_llm_provider()
    try:
        response = await llm.complete_json(system_prompt, user_prompt)
    except Exception as e:
        logger.exception("methodology: LLM call failed")
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}") from e

    raw_instances = response.get("instances") if isinstance(response, dict) else None
    if not isinstance(raw_instances, list) or not raw_instances:
        raise HTTPException(
            status_code=502,
            detail="LLM did not return any instances. Try again with more captured content.",
        )

    saved: list[MethodologyArtifact] = []
    author = user_label(current_user.get())
    for raw in raw_instances[: payload.count]:
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title") or "").strip()
        field_values: dict[str, str] = {}
        for f in fields:
            val = raw.get(f)
            if isinstance(val, list):
                val = "\n".join(str(item) for item in val if item)
            field_values[f] = str(val or "").strip()
        if not title and not any(field_values.values()):
            continue
        record = MethodologyArtifact(
            id=str(uuid.uuid4()),
            discovery_id=payload.discovery_id,
            method_id=method_id,
            instance_id=str(uuid.uuid4()),
            title=title or _fallback_title(method_id, field_values),
            fields=field_values,
            source="auto",
            author=author,
        ).model_dump(mode="json")
        stamp_create(record)
        stored = await storage.create(COLLECTION, record)
        saved.append(MethodologyArtifact(**stored))

    if not saved:
        raise HTTPException(
            status_code=502,
            detail="LLM returned no usable instances. Try again with more captured content.",
        )

    return saved


def _fallback_title(method_id: str, fields: dict[str, str]) -> str:
    if method_id == "persona" and fields.get("name"):
        return fields["name"][:60]
    if method_id == "empathy-map" and fields.get("says"):
        first = fields["says"].splitlines()[0]
        return first[:60]
    if method_id == "hmw-board" and fields.get("hmw"):
        return fields["hmw"][:60]
    if method_id == "champion-map" and fields.get("champion"):
        return fields["champion"].splitlines()[0][:60]
    return "Untitled"
