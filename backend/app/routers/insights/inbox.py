from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.providers.storage import get_storage_provider

from ._shared import (
    get_discovery_or_404,
    list_comments_for_project,
    project_id_of,
)

router = APIRouter()


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


async def _list_question_sets(discovery_id: str) -> list[dict]:
    storage = get_storage_provider()
    for key in ("discovery_id", "discoveryId"):
        try:
            sets = await storage.list("question_sets", {key: discovery_id})
        except Exception:
            sets = []
        if sets:
            return sets
    return []


def _latest_set_per_phase(sets: list[dict]) -> dict[str, dict]:
    latest: dict[str, dict] = {}
    for s in sets:
        phase = s.get("phase") or "orchestrate"
        prev = latest.get(phase)
        if not prev or (s.get("created_at", "") > prev.get("created_at", "")):
            latest[phase] = s
    return latest


def _collect_questions(latest_by_phase: dict[str, dict]) -> list[InboxQuestion]:
    out: list[InboxQuestion] = []
    for phase, s in latest_by_phase.items():
        for q in s.get("questions") or []:
            out.append(
                InboxQuestion(
                    text=str(q.get("text") or ""),
                    purpose=str(q.get("purpose") or ""),
                    set_id=str(s.get("id") or ""),
                    set_phase=phase,
                    created_at=str(s.get("created_at") or ""),
                )
            )
    return out


def _collect_assumptions(disc: dict) -> list[InboxAssumption]:
    out: list[InboxAssumption] = []
    for a in disc.get("assumptions") or []:
        conf = (a.get("confidence") or "").lower()
        if conf == "validated":
            continue
        out.append(
            InboxAssumption(
                id=str(a.get("id") or ""),
                statement=str(a.get("statement") or ""),
                confidence=conf or "unknown",
                impact=str(a.get("impact") or ""),
            )
        )
    return out


def _collect_recent_comments(project_id: str, raw: list[dict]) -> list[InboxComment]:
    raw.sort(key=lambda c: c.get("created_at", ""), reverse=True)
    out: list[InboxComment] = []
    for c in raw[:10]:
        out.append(
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
    return out


@router.get("/inbox", response_model=InboxResponse)
async def inbox(discovery_id: str = Query(...)) -> InboxResponse:
    disc = await get_discovery_or_404(discovery_id)

    sets = await _list_question_sets(discovery_id)
    questions = _collect_questions(_latest_set_per_phase(sets))
    assumptions = _collect_assumptions(disc)

    project_id = project_id_of(disc)
    raw_comments = await list_comments_for_project(project_id) if project_id else []
    comments_out = _collect_recent_comments(project_id, raw_comments) if project_id else []

    return InboxResponse(
        open_questions=questions,
        unvalidated_assumptions=assumptions,
        recent_comments=comments_out,
    )
