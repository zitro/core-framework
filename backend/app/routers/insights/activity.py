from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from ._shared import (
    get_discovery_or_404,
    list_comments_for_project,
    list_for_discovery,
    project_id_of,
    shorten,
)

router = APIRouter()


class ActivityEvent(BaseModel):
    kind: str
    title: str
    summary: str = ""
    surface: str
    created_at: str


class ActivityResponse(BaseModel):
    events: list[ActivityEvent]


def _ev(kind: str, title: str, summary: str, surface: str, created_at: str) -> ActivityEvent:
    return ActivityEvent(
        kind=kind,
        title=title,
        summary=summary,
        surface=surface,
        created_at=created_at,
    )


def _evidence_event(ev: dict) -> ActivityEvent:
    return _ev(
        "evidence",
        f"{ev.get('evidence_type', 'evidence')} captured",
        shorten(ev.get("content", "")),
        f"/{ev.get('phase', 'capture')}",
        str(ev.get("created_at") or ""),
    )


def _brief_event(b: dict) -> ActivityEvent:
    return _ev(
        "brief",
        f"Brief v{b.get('version', '?')}: {b.get('title', '(untitled)')}",
        shorten(b.get("summary", "")),
        "/orchestrate?tab=overview",
        str(b.get("created_at") or ""),
    )


def _problem_event(ps: dict) -> ActivityEvent:
    return _ev(
        "problem",
        f"Problem statement v{ps.get('version', '?')}",
        shorten(ps.get("statement", "")),
        "/orchestrate?tab=drafts",
        str(ps.get("created_at") or ""),
    )


def _usecase_event(uc: dict) -> ActivityEvent:
    return _ev(
        "usecase",
        f"Use case v{uc.get('version', '?')}: {uc.get('title', '(untitled)')}",
        shorten(uc.get("summary", "")),
        "/orchestrate?tab=drafts",
        str(uc.get("created_at") or ""),
    )


def _review_event(r: dict) -> ActivityEvent:
    return _ev(
        "review",
        f"Expert review v{r.get('version', '?')}",
        shorten(r.get("synthesis", "")),
        "/refine?tab=experts",
        str(r.get("created_at") or ""),
    )


def _blueprint_event(bp: dict) -> ActivityEvent:
    return _ev(
        "blueprint",
        f"Blueprint v{bp.get('version', '?')}: {bp.get('title', '(untitled)')}",
        shorten(bp.get("summary", "")),
        "/refine?tab=architect",
        str(bp.get("created_at") or ""),
    )


def _comment_event(c: dict) -> ActivityEvent:
    author = str(c.get("author") or c.get("role") or "user")
    return _ev(
        "comment",
        f"{author} commented",
        shorten(c.get("body", "")),
        "/orchestrate",
        str(c.get("created_at") or ""),
    )


_BUILDERS: list[tuple[str, callable]] = [
    ("evidence", _evidence_event),
    ("context_briefs", _brief_event),
    ("problem_statements", _problem_event),
    ("use_cases", _usecase_event),
    ("refine_reviews", _review_event),
    ("solution_blueprints", _blueprint_event),
]


@router.get("/activity", response_model=ActivityResponse)
async def activity(
    discovery_id: str = Query(...),
    limit: int = Query(30, ge=1, le=100),
) -> ActivityResponse:
    disc = await get_discovery_or_404(discovery_id)

    events: list[ActivityEvent] = []
    for collection, build in _BUILDERS:
        for row in await list_for_discovery(collection, discovery_id):
            events.append(build(row))

    project_id = project_id_of(disc)
    for c in await list_comments_for_project(project_id):
        events.append(_comment_event(c))

    events.sort(key=lambda e: e.created_at, reverse=True)
    return ActivityResponse(events=events[:limit])
