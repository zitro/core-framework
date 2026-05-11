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


# ── activity feed ──────────────────────────────────────────────────────


class ActivityEvent(BaseModel):
    kind: str
    title: str
    summary: str = ""
    surface: str
    created_at: str


class ActivityResponse(BaseModel):
    events: list[ActivityEvent]


def _shorten(text: str, n: int = 140) -> str:
    s = (text or "").strip().replace("\n", " ")
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


@router.get("/activity", response_model=ActivityResponse)
async def activity(
    discovery_id: str = Query(...),
    limit: int = Query(30, ge=1, le=100),
) -> ActivityResponse:
    """Return a discovery's recent events, newest-first.

    Pulls from every collection that grows when work happens: evidence,
    context_briefs, problem_statements, use_cases, refine_reviews,
    solution_blueprints, and artifact_comments (via the engagement_id).
    """
    storage = get_storage_provider()
    disc = await storage.get("discoveries", discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    events: list[ActivityEvent] = []

    async def _list_disc(collection: str) -> list[dict]:
        for key in ("discovery_id", "discoveryId"):
            try:
                items = await storage.list(collection, {key: discovery_id})
            except Exception:
                items = []
            if items:
                return items
        return []

    for ev in await _list_disc("evidence"):
        events.append(
            ActivityEvent(
                kind="evidence",
                title=f"{ev.get('evidence_type', 'evidence')} captured",
                summary=_shorten(ev.get("content", "")),
                surface=f"/{ev.get('phase', 'capture')}",
                created_at=str(ev.get("created_at") or ""),
            )
        )

    for b in await _list_disc("context_briefs"):
        events.append(
            ActivityEvent(
                kind="brief",
                title=f"Brief v{b.get('version', '?')}: {b.get('title', '(untitled)')}",
                summary=_shorten(b.get("summary", "")),
                surface="/orchestrate?tab=overview",
                created_at=str(b.get("created_at") or ""),
            )
        )

    for ps in await _list_disc("problem_statements"):
        events.append(
            ActivityEvent(
                kind="problem",
                title=f"Problem statement v{ps.get('version', '?')}",
                summary=_shorten(ps.get("statement", "")),
                surface="/orchestrate?tab=drafts",
                created_at=str(ps.get("created_at") or ""),
            )
        )

    for uc in await _list_disc("use_cases"):
        events.append(
            ActivityEvent(
                kind="usecase",
                title=f"Use case v{uc.get('version', '?')}: {uc.get('title', '(untitled)')}",
                summary=_shorten(uc.get("summary", "")),
                surface="/orchestrate?tab=drafts",
                created_at=str(uc.get("created_at") or ""),
            )
        )

    for r in await _list_disc("refine_reviews"):
        events.append(
            ActivityEvent(
                kind="review",
                title=f"Expert review v{r.get('version', '?')}",
                summary=_shorten(r.get("synthesis", "")),
                surface="/refine?tab=experts",
                created_at=str(r.get("created_at") or ""),
            )
        )

    for bp in await _list_disc("solution_blueprints"):
        events.append(
            ActivityEvent(
                kind="blueprint",
                title=f"Blueprint v{bp.get('version', '?')}: {bp.get('title', '(untitled)')}",
                summary=_shorten(bp.get("summary", "")),
                surface="/refine?tab=architect",
                created_at=str(bp.get("created_at") or ""),
            )
        )

    project_id = str(disc.get("engagement_id") or disc.get("project_id") or "")
    if project_id:
        try:
            comments = await storage.list("artifact_comments", {"project_id": project_id})
        except Exception:
            comments = []
        for c in comments:
            author = str(c.get("author") or c.get("role") or "user")
            events.append(
                ActivityEvent(
                    kind="comment",
                    title=f"{author} commented",
                    summary=_shorten(c.get("body", "")),
                    surface="/orchestrate",
                    created_at=str(c.get("created_at") or ""),
                )
            )

    events.sort(key=lambda e: e.created_at, reverse=True)
    return ActivityResponse(events=events[:limit])


# ── stakeholders ───────────────────────────────────────────────────────


class Stakeholder(BaseModel):
    name: str
    role: str = ""
    org: str = ""
    influence: str = ""
    source: str  # "discovery" | "engagement_context"


class StakeholdersResponse(BaseModel):
    by_org: dict[str, list[Stakeholder]]
    total: int


@router.get("/stakeholders", response_model=StakeholdersResponse)
async def stakeholders(discovery_id: str = Query(...)) -> StakeholdersResponse:
    """Roll-up of every stakeholder mentioned for the discovery's project.

    Pulls from two sources, de-duplicated by name+role:
      - Discovery.stakeholders (Capture-era list on the discovery itself)
      - EngagementContext.stakeholders (the engagement-context record,
        keyed by project_id from discovery.engagement_id)

    Grouped by org so the UI can render a card per org with the people in it.
    """
    storage = get_storage_provider()
    disc = await storage.get("discoveries", discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    seen: set[tuple[str, str]] = set()
    rolled: list[Stakeholder] = []

    for s in disc.get("stakeholders") or []:
        name = str(s.get("name") or "").strip()
        role = str(s.get("role") or "").strip()
        if not name:
            continue
        key = (name.lower(), role.lower())
        if key in seen:
            continue
        seen.add(key)
        rolled.append(
            Stakeholder(
                name=name,
                role=role,
                org=str(s.get("org") or ""),
                influence=str(s.get("influence") or ""),
                source="discovery",
            )
        )

    project_id = str(disc.get("engagement_id") or disc.get("project_id") or "")
    if project_id:
        try:
            ctxs = await storage.list("engagement_contexts", {"project_id": project_id})
        except Exception:
            ctxs = []
        if ctxs:
            ec = ctxs[0]
            for s in ec.get("stakeholders") or []:
                name = str(s.get("name") or "").strip()
                role = str(s.get("role") or "").strip()
                if not name:
                    continue
                key = (name.lower(), role.lower())
                if key in seen:
                    continue
                seen.add(key)
                rolled.append(
                    Stakeholder(
                        name=name,
                        role=role,
                        org=str(s.get("org") or ""),
                        influence=str(s.get("influence") or ""),
                        source="engagement_context",
                    )
                )

    by_org: dict[str, list[Stakeholder]] = {}
    for s in rolled:
        bucket = s.org or "Unspecified"
        by_org.setdefault(bucket, []).append(s)

    return StakeholdersResponse(by_org=by_org, total=len(rolled))


# ── decisions log ──────────────────────────────────────────────────────


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


@router.get("/decisions", response_model=DecisionsResponse)
async def decisions(discovery_id: str = Query(...)) -> DecisionsResponse:
    """Return decisions captured for a discovery, newest-first.

    Decisions live as evidence items tagged ``"decision"`` (per the
    Capture tab's Decision capture type config). This endpoint pulls
    every evidence row across phases that carries that tag.
    """
    storage = get_storage_provider()
    disc = await storage.get("discoveries", discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    rows: list[dict] = []
    for key in ("discovery_id", "discoveryId"):
        try:
            rows = await storage.list("evidence", {key: discovery_id})
        except Exception:
            rows = []
        if rows:
            break

    out: list[Decision] = []
    for r in rows:
        tags = [str(t).lower() for t in (r.get("tags") or [])]
        if "decision" not in tags:
            continue
        out.append(
            Decision(
                id=str(r.get("id") or ""),
                text=str(r.get("content") or ""),
                source=str(r.get("source") or ""),
                phase=str(r.get("phase") or ""),
                rationale="",
                tags=tags,
                created_at=str(r.get("created_at") or ""),
            )
        )

    out.sort(key=lambda d: d.created_at, reverse=True)
    return DecisionsResponse(decisions=out, total=len(out))
