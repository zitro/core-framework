"""Corpus-grounded chat endpoints.

POST /{project_id}/chat                — one turn, LLM-backed
GET  /{project_id}/chat?session_id=…   — list turns
"""

from __future__ import annotations

import logging

from fastapi import HTTPException
from pydantic import BaseModel, Field

from app.providers.storage import get_storage_provider
from app.routers.synthesis._helpers import load_project
from app.routers.synthesis._router import router
from app.synthesis.chat import CHATS_COLLECTION, ChatAgent
from app.synthesis.corpus import build_corpus

logger = logging.getLogger(__name__)


class ChatPayload(BaseModel):
    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=10_000)


@router.post("/{project_id}/chat")
async def chat(project_id: str, payload: ChatPayload) -> dict:
    """Send a user message in a session, get a corpus-grounded reply.
    LLM-backed; user-initiated, never auto-fired."""
    project = await load_project(project_id)
    corpus = await build_corpus(project)

    # Reconstruct session history from previously-persisted turns.
    storage = get_storage_provider()
    raw_turns: list[dict] = []
    for key in ("project_id", "projectId"):
        try:
            raw_turns = await storage.list(
                CHATS_COLLECTION,
                {key: project_id, "session_id": payload.session_id},
            )
        except Exception:
            raw_turns = []
        if raw_turns:
            break
    history = [
        {"role": t.get("role", "user"), "content": t.get("content", "")}
        for t in sorted(raw_turns, key=lambda t: t.get("created_at", ""))
    ]

    try:
        result = await ChatAgent().reply(
            project, payload.session_id, payload.message, corpus, history
        )
    except Exception as exc:
        logger.exception("chat: failed for session=%s", payload.session_id)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc
    return result


@router.get("/{project_id}/chat")
async def list_chat_turns(project_id: str, session_id: str | None = None) -> dict:
    """List chat turns for a project, optionally filtered to one session."""
    await load_project(project_id)
    storage = get_storage_provider()
    filters: dict = {"project_id": project_id}
    if session_id:
        filters["session_id"] = session_id
    items: list[dict] = []
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(CHATS_COLLECTION, {**filters, key: project_id})
        except Exception:
            items = []
        if items:
            break
    items.sort(key=lambda t: t.get("created_at", ""))
    return {"turns": items}
