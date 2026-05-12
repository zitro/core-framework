from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.providers.storage import get_storage_provider

from ._shared import Phase, get_discovery_or_404

router = APIRouter()


class CoverageCell(BaseModel):
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
    storage = get_storage_provider()
    if ":" in spec_id:
        collection, phase = spec_id.split(":", 1)
    else:
        collection, phase = spec_id, None

    if collection == "assumptions":
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


def _status_for(count: int) -> Literal["missing", "draft", "ok"]:
    if count == 0:
        return "missing"
    if count < 3:
        return "draft"
    return "ok"


@router.get("/coverage", response_model=CoverageResponse)
async def coverage(discovery_id: str = Query(...)) -> CoverageResponse:
    await get_discovery_or_404(discovery_id)

    cells: list[CoverageCell] = []
    totals: dict[str, int] = {"capture": 0, "orchestrate": 0, "refine": 0, "execute": 0}
    for spec_id, label, phase in _COVERAGE_SPEC:
        count = await _count_for_spec(discovery_id, spec_id)
        cells.append(
            CoverageCell(
                phase=phase,
                type_id=spec_id.replace(":", "_"),
                label=label,
                count=count,
                status=_status_for(count),
            )
        )
        totals[phase] += count

    return CoverageResponse(
        phases=["capture", "orchestrate", "refine", "execute"],
        cells=cells,
        totals=totals,
    )
