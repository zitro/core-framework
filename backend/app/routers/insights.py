"""Cross-cutting insight endpoints (Phase 8).

Read-side aggregations that span phases. Each tool gets its own endpoint
so the frontend can lazy-load only the panel that's currently open.

  GET /api/insights/coverage?discovery_id=...   coverage heatmap data

The frontend page at /insights houses every tool as a tab; this router
will grow as we add Activity / Decision log / Stakeholder map / etc.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

Phase = Literal["capture", "orchestrate", "refine", "execute"]


class CoverageCell(BaseModel):
    """One cell of the coverage matrix: a (phase, category) slot with a count."""

    phase: Phase
    type_id: str
    label: str
    count: int
    status: Literal["missing", "draft", "ok"]


class CoverageResponse(BaseModel):
    phases: list[Phase]
    cells: list[CoverageCell]
    totals: dict[str, int]


_COVERAGE_SPEC: list[tuple[str, str, Phase]] = [
    ("evidence:capture", "Evidence", "capture"),
    ("transcript_analyses:capture", "Transcripts", "capture"),
    ("context_briefs", "Project briefs", "orchestrate"),
    ("question_sets:orchestrate", "Question sets", "orchestrate"),
    ("problem_statements", "Problem statements", "orchestrate"),
    ("use_cases", "Use cases", "orchestrate"),
    ("refine_reviews", "Expert reviews", "refine"),
    ("solution_blueprints", "Blueprint candidates", "refine"),
    ("assumptions:refine", "Assumptions tracked", "refine"),
    ("execute_outputs", "Execute outputs", "execute"),
]


async def _count_for_spec(discovery_id: str, spec_id: str) -> int:
    """Count items matching the spec. spec_id is ``collection`` or
    ``collection:phase`` when a phase filter applies."""
    storage = get_storage_provider()
    if ":" in spec_id:
        collection, phase = spec_id.split(":", 1)
    else:
        collection, phase = spec_id, None

    if collection == "assumptions":
        # Assumptions live on the discovery record itself.
        disc = await storage.get("discoveries", discovery_id)
        if not disc:
            return 0
        return len(disc.get("assumptions") or [])

    items: list[dict] = []
    for key in ("discovery_id", "discoveryId"):
        try:
            query: dict = {key: discovery_id}
            if phase:
                query["phase"] = phase
            items = await storage.list(collection, query)
        except Exception:
            items = []
        if items:
            break
    return len(items)


@router.get("/coverage", response_model=CoverageResponse)
async def coverage(discovery_id: str = Query(...)) -> CoverageResponse:
    """Return the coverage matrix for a discovery — counts per (phase, type)."""
    storage = get_storage_provider()
    disc = await storage.get("discoveries", discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    cells: list[CoverageCell] = []
    totals: dict[str, int] = {"capture": 0, "orchestrate": 0, "refine": 0, "execute": 0}
    for spec_id, label, phase in _COVERAGE_SPEC:
        count = await _count_for_spec(discovery_id, spec_id)
        status: Literal["missing", "draft", "ok"]
        if count == 0:
            status = "missing"
        elif count < 3:
            status = "draft"
        else:
            status = "ok"
        cells.append(
            CoverageCell(
                phase=phase,
                type_id=spec_id.replace(":", "_"),
                label=label,
                count=count,
                status=status,
            )
        )
        totals[phase] += count

    return CoverageResponse(
        phases=["capture", "orchestrate", "refine", "execute"],
        cells=cells,
        totals=totals,
    )
