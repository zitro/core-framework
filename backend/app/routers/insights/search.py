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


class SearchHit(BaseModel):
    kind: str
    title: str
    snippet: str
    surface: str
    score: int


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHit]
    total: int


def _snippet_around(text: str, needle: str, width: int = 160) -> str:
    if not text:
        return ""
    haystack = text.lower()
    needle_l = needle.lower()
    idx = haystack.find(needle_l)
    if idx < 0:
        return shorten(text, width)
    half = max(0, width // 2 - len(needle))
    start = max(0, idx - half)
    end = min(len(text), idx + len(needle) + half)
    snippet = text[start:end].strip().replace("\n", " ")
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


def _score_text(text: str, terms: list[str]) -> int:
    if not text:
        return 0
    lower = text.lower()
    return sum(lower.count(t.lower()) for t in terms)


def _evidence_hit(ev: dict, terms: list[str]) -> SearchHit | None:
    text = str(ev.get("content") or "")
    score = _score_text(text, terms) + _score_text(str(ev.get("source") or ""), terms)
    if not score:
        return None
    return SearchHit(
        kind="evidence",
        title=f"{ev.get('evidence_type', 'evidence')} · {ev.get('source', '')}".strip(" ·"),
        snippet=_snippet_around(text, terms[0]),
        surface=f"/{ev.get('phase', 'capture')}",
        score=score,
    )


def _brief_hit(b: dict, terms: list[str]) -> SearchHit | None:
    text = f"{b.get('title', '')}\n{b.get('summary', '')}\n{b.get('evidence_summary', '')}"
    score = _score_text(text, terms)
    if not score:
        return None
    return SearchHit(
        kind="brief",
        title=f"Brief v{b.get('version', '?')}: {b.get('title', '(untitled)')}",
        snippet=_snippet_around(text, terms[0]),
        surface="/orchestrate?tab=overview",
        score=score,
    )


def _problem_hit(ps: dict, terms: list[str]) -> SearchHit | None:
    text = " ".join(str(ps.get(k) or "") for k in ("statement", "who", "what", "why", "impact"))
    score = _score_text(text, terms)
    if not score:
        return None
    return SearchHit(
        kind="problem",
        title=f"Problem statement v{ps.get('version', '?')}",
        snippet=_snippet_around(text, terms[0]),
        surface="/orchestrate?tab=drafts",
        score=score,
    )


_USECASE_FIELDS = ("title", "summary", "goal", "current_state", "desired_state", "business_value")


def _usecase_hit(uc: dict, terms: list[str]) -> SearchHit | None:
    text = " ".join(str(uc.get(k) or "") for k in _USECASE_FIELDS)
    score = _score_text(text, terms)
    if not score:
        return None
    return SearchHit(
        kind="usecase",
        title=f"Use case v{uc.get('version', '?')}: {uc.get('title', '(untitled)')}",
        snippet=_snippet_around(text, terms[0]),
        surface="/orchestrate?tab=drafts",
        score=score,
    )


def _comment_hit(c: dict, terms: list[str]) -> SearchHit | None:
    text = str(c.get("body") or "")
    score = _score_text(text, terms)
    if not score:
        return None
    return SearchHit(
        kind="comment",
        title=f"{c.get('author') or c.get('role') or 'user'} commented",
        snippet=_snippet_around(text, terms[0]),
        surface="/orchestrate",
        score=score,
    )


_SOURCES: list[tuple[str, callable]] = [
    ("evidence", _evidence_hit),
    ("context_briefs", _brief_hit),
    ("problem_statements", _problem_hit),
    ("use_cases", _usecase_hit),
]


@router.get("/search", response_model=SearchResponse)
async def search(
    discovery_id: str = Query(...),
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(30, ge=1, le=100),
) -> SearchResponse:
    disc = await get_discovery_or_404(discovery_id)

    terms = [t for t in q.split() if t.strip()]
    if not terms:
        return SearchResponse(query=q, hits=[], total=0)

    hits: list[SearchHit] = []
    for collection, build in _SOURCES:
        for row in await list_for_discovery(collection, discovery_id):
            hit = build(row, terms)
            if hit is not None:
                hits.append(hit)

    project_id = project_id_of(disc)
    for c in await list_comments_for_project(project_id):
        hit = _comment_hit(c, terms)
        if hit is not None:
            hits.append(hit)

    hits.sort(key=lambda h: h.score, reverse=True)
    return SearchResponse(query=q, hits=hits[:limit], total=len(hits))
