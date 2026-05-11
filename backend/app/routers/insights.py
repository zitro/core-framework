"""Cross-cutting insight endpoints (Phase 8).

Read-side aggregations that span phases. Each tool gets its own endpoint
so the frontend can lazy-load only the panel that's currently open.

  GET /api/insights/coverage?discovery_id=...   coverage heatmap
  GET /api/insights/inbox?discovery_id=...      actionable open items

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


# ── inbox ──────────────────────────────────────────────────────────────


class InboxQuestion(BaseModel):
    text: str
    purpose: str = ""
    set_id: str
    set_phase: str
    created_at: str = ""


class InboxAssumption(BaseModel):
    id: str
    statement: str
    confidence: str
    impact: str = ""


class InboxComment(BaseModel):
    id: str
    thread_id: str
    artifact_id: str
    project_id: str
    role: str
    author: str
    body: str
    created_at: str


class InboxResponse(BaseModel):
    open_questions: list[InboxQuestion]
    unvalidated_assumptions: list[InboxAssumption]
    recent_comments: list[InboxComment]


@router.get("/inbox", response_model=InboxResponse)
async def inbox(discovery_id: str = Query(...)) -> InboxResponse:
    """Return actionable open items for a discovery.

    Combines three streams:
      - Open questions from question_sets (questions without a saved answer
        in the matching evidence record — best-effort: returns *all*
        questions and lets the UI filter)
      - Assumptions not yet validated (confidence != "validated")
      - Recent thread comments (last 10 across all artifacts for any
        engagements referencing this discovery)
    """
    storage = get_storage_provider()
    disc = await storage.get("discoveries", discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    # ── open questions ────────────────────────────────────────────────
    questions: list[InboxQuestion] = []
    sets: list[dict] = []
    for key in ("discovery_id", "discoveryId"):
        try:
            sets = await storage.list("question_sets", {key: discovery_id})
        except Exception:
            sets = []
        if sets:
            break

    # Pull the latest set per phase so the user isn't drowning in old questions.
    latest_by_phase: dict[str, dict] = {}
    for s in sets:
        phase = s.get("phase") or "orchestrate"
        prev = latest_by_phase.get(phase)
        if not prev or (s.get("created_at", "") > prev.get("created_at", "")):
            latest_by_phase[phase] = s
    for phase, s in latest_by_phase.items():
        for q in s.get("questions") or []:
            questions.append(
                InboxQuestion(
                    text=str(q.get("text") or ""),
                    purpose=str(q.get("purpose") or ""),
                    set_id=str(s.get("id") or ""),
                    set_phase=phase,
                    created_at=str(s.get("created_at") or ""),
                )
            )

    # ── unvalidated assumptions ───────────────────────────────────────
    assumptions: list[InboxAssumption] = []
    for a in disc.get("assumptions") or []:
        conf = (a.get("confidence") or "").lower()
        if conf == "validated":
            continue
        assumptions.append(
            InboxAssumption(
                id=str(a.get("id") or ""),
                statement=str(a.get("statement") or ""),
                confidence=conf or "unknown",
                impact=str(a.get("impact") or ""),
            )
        )

    # ── recent comments ───────────────────────────────────────────────
    # Comments are scoped by project_id, not discovery_id. Discovery has
    # an engagement_id which is the project_id for artifact threads.
    comments_out: list[InboxComment] = []
    project_id = str(disc.get("engagement_id") or disc.get("project_id") or "")
    if project_id:
        try:
            raw = await storage.list("artifact_comments", {"project_id": project_id})
        except Exception:
            raw = []
        raw.sort(key=lambda c: c.get("created_at", ""), reverse=True)
        for c in raw[:10]:
            comments_out.append(
                InboxComment(
                    id=str(c.get("id") or ""),
                    thread_id=str(c.get("thread_id") or ""),
                    artifact_id=str(c.get("artifact_id") or ""),
                    project_id=project_id,
                    role=str(c.get("role") or "user"),
                    author=str(c.get("author") or ""),
                    body=str(c.get("body") or ""),
                    created_at=str(c.get("created_at") or ""),
                )
            )

    return InboxResponse(
        open_questions=questions,
        unvalidated_assumptions=assumptions,
        recent_comments=comments_out,
    )
