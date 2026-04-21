"""Grounded answer endpoint — combines web search snippets with the LLM."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.llm import get_llm_provider
from app.providers.search import get_search_provider

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

SYSTEM = (
    "You are a careful research assistant. You answer the user's question "
    "using ONLY the supplied web snippets. Always cite the URL inline as "
    "[source:N] where N is the 1-based index of the snippet. If the "
    "snippets do not contain the answer, say so explicitly and propose a "
    "follow-up search.\n\n"
    "Return JSON with this exact shape:\n"
    "{\n"
    '  "answer": "the grounded answer with [source:N] citations",\n'
    '  "confidence": "low|medium|high",\n'
    '  "follow_ups": ["..."],\n'
    '  "citations": [{"index": 1, "title": "...", "url": "..."}]\n'
    "}"
)


class GroundingRequest(BaseModel):
    question: str = Field(min_length=1)
    limit: int = 6


@router.post("/answer")
async def answer(req: GroundingRequest) -> dict:
    search = get_search_provider()
    if not search.enabled:
        raise HTTPException(
            status_code=503,
            detail="Search provider not configured (set SEARCH_PROVIDER)",
        )

    try:
        results = await search.search(req.question, limit=req.limit)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Grounding search failed")
        raise HTTPException(status_code=502, detail="Search backend unavailable") from exc

    snippets = [
        {"index": i + 1, "title": r.title, "url": r.url, "snippet": r.snippet}
        for i, r in enumerate(results)
    ]
    snippet_block = (
        "\n".join(
            f"[{s['index']}] {s['title']} <{s['url']}>\n  {s['snippet']}" for s in snippets
        )
        or "(no results)"
    )
    user_prompt = (
        f"Question: {req.question}\n\nSnippets:\n{snippet_block}\n\n"
        "Answer the question using only these snippets and cite them inline."
    )

    try:
        result = await get_llm_provider().complete_json(SYSTEM, user_prompt, max_tokens=1200)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Grounding LLM call failed")
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    if isinstance(result, dict):
        result.setdefault(
            "citations",
            [{"index": s["index"], "title": s["title"], "url": s["url"]} for s in snippets],
        )
    return {"question": req.question, "snippets": snippets, "result": result}
