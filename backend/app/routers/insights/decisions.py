from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ._shared import get_discovery_or_404, list_for_discovery

router = APIRouter()


class Decision(BaseModel):
    id: str
    text: str
    source: str = ""
    phase: str
    rationale: str = ""
    tags: list[str]
    created_at: str


class DecisionsResponse(BaseModel):
    decisions: list[Decision]
    total: int


def _row_to_decision(r: dict, tags: list[str]) -> Decision:
    return Decision(
        id=str(r.get("id") or ""),
        text=str(r.get("content") or ""),
        source=str(r.get("source") or ""),
        phase=str(r.get("phase") or ""),
        rationale="",
        tags=tags,
        created_at=str(r.get("created_at") or ""),
    )


@router.get("/decisions", response_model=DecisionsResponse)
async def decisions(discovery_id: str = Query(...)) -> DecisionsResponse:
    await get_discovery_or_404(discovery_id)

    rows = await list_for_discovery("evidence", discovery_id)

    out: list[Decision] = []
    for r in rows:
        tags = [str(t).lower() for t in (r.get("tags") or [])]
        if "decision" not in tags:
            continue
        out.append(_row_to_decision(r, tags))

    out.sort(key=lambda d: d.created_at, reverse=True)
    return DecisionsResponse(decisions=out, total=len(out))
