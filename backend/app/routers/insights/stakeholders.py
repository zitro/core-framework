from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.providers.storage import get_storage_provider

from ._shared import get_discovery_or_404, project_id_of

router = APIRouter()


class Stakeholder(BaseModel):
    name: str
    role: str = ""
    org: str = ""
    influence: str = ""
    source: str


class StakeholdersResponse(BaseModel):
    by_org: dict[str, list[Stakeholder]]
    total: int


def _normalize(s: dict, source: str) -> Stakeholder | None:
    name = str(s.get("name") or "").strip()
    if not name:
        return None
    return Stakeholder(
        name=name,
        role=str(s.get("role") or "").strip(),
        org=str(s.get("org") or ""),
        influence=str(s.get("influence") or ""),
        source=source,
    )


def _dedupe_append(
    rolled: list[Stakeholder],
    seen: set[tuple[str, str]],
    candidate: Stakeholder | None,
) -> None:
    if candidate is None:
        return
    key = (candidate.name.lower(), candidate.role.lower())
    if key in seen:
        return
    seen.add(key)
    rolled.append(candidate)


async def _engagement_context_for(project_id: str) -> dict | None:
    if not project_id:
        return None
    storage = get_storage_provider()
    try:
        ctxs = await storage.list("engagement_contexts", {"project_id": project_id})
    except Exception:
        ctxs = []
    return ctxs[0] if ctxs else None


@router.get("/stakeholders", response_model=StakeholdersResponse)
async def stakeholders(discovery_id: str = Query(...)) -> StakeholdersResponse:
    disc = await get_discovery_or_404(discovery_id)

    seen: set[tuple[str, str]] = set()
    rolled: list[Stakeholder] = []

    for s in disc.get("stakeholders") or []:
        _dedupe_append(rolled, seen, _normalize(s, "discovery"))

    ec = await _engagement_context_for(project_id_of(disc))
    if ec:
        for s in ec.get("stakeholders") or []:
            _dedupe_append(rolled, seen, _normalize(s, "engagement_context"))

    by_org: dict[str, list[Stakeholder]] = {}
    for s in rolled:
        by_org.setdefault(s.org or "Unspecified", []).append(s)

    return StakeholdersResponse(by_org=by_org, total=len(rolled))
