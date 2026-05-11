"""Per-Artifact thread, comments, and grounded chat.

Routes (mounted under ``/api/synthesis``):

- GET    /{project_id}/artifacts/{artifact_id}/thread
    Auto-creates and returns the thread + its comments.
- POST   /{project_id}/artifacts/{artifact_id}/comments
    Append a human note (role user|system).
- DELETE /{project_id}/artifacts/{artifact_id}/comments/{comment_id}
    Remove a comment.
- POST   /{project_id}/artifacts/{artifact_id}/chat
    Ask the AI about this artifact. Stores user + assistant pair
    atomically with a shared turn_id.

Threads + comments are project-partitioned. Prompt-rendering helpers
live in ``app/utils/artifact_chat_prompts.py``.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.artifact_thread import (
    ArtifactComment,
    ArtifactThread,
    ChatTurnCreate,
    CommentCreate,
    CommentRole,
)
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.artifact_chat_prompts import (
    CHAT_SYSTEM,
    render_artifact_for_prompt,
    render_engagement_context,
    render_history,
)
from app.utils.audit import current_user, stamp_create, stamp_update, user_label

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

THREADS = "artifact_threads"
COMMENTS = "artifact_comments"
ARTIFACTS = "artifacts"


# ── helpers ────────────────────────────────────────────────────────────


async def _load_artifact(project_id: str, artifact_id: str) -> dict:
    storage = get_storage_provider()
    art = await storage.get(ARTIFACTS, artifact_id)
    if not art or art.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return art


async def _get_or_create_thread(project_id: str, artifact_id: str) -> dict:
    storage = get_storage_provider()
    existing = await storage.list(THREADS, {"project_id": project_id, "artifact_id": artifact_id})
    if existing:
        return existing[0]

    art = await _load_artifact(project_id, artifact_id)
    thread = ArtifactThread(
        id=str(uuid.uuid4()),
        project_id=project_id,
        artifact_id=artifact_id,
        title=art.get("title", ""),
    ).model_dump(mode="json")
    stamp_create(thread)
    return await storage.create(THREADS, thread)


async def _list_comments(thread_id: str) -> list[dict]:
    storage = get_storage_provider()
    items = await storage.list(COMMENTS, {"thread_id": thread_id})
    items.sort(key=lambda c: c.get("created_at", ""))
    return items


async def _bump_thread(thread: dict, *, delta: int) -> None:
    storage = get_storage_provider()
    updates = {
        "comment_count": max(0, int(thread.get("comment_count", 0)) + delta),
        "last_activity_at": datetime.now(UTC).isoformat(),
    }
    stamp_update(updates)
    await storage.update(THREADS, thread["id"], updates)


# ── routes ─────────────────────────────────────────────────────────────


@router.get("/{project_id}/artifacts/{artifact_id}/thread")
async def get_thread(project_id: str, artifact_id: str) -> dict:
    thread = await _get_or_create_thread(project_id, artifact_id)
    comments = await _list_comments(thread["id"])
    return {"thread": thread, "comments": comments}


@router.post(
    "/{project_id}/artifacts/{artifact_id}/comments",
    response_model=ArtifactComment,
)
async def post_comment(
    project_id: str, artifact_id: str, payload: CommentCreate
) -> ArtifactComment:
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Comment body is required")
    thread = await _get_or_create_thread(project_id, artifact_id)
    storage = get_storage_provider()

    author = payload.author or user_label(current_user.get())
    comment = ArtifactComment(
        id=str(uuid.uuid4()),
        thread_id=thread["id"],
        role=CommentRole(payload.role),
        author=author,
        body=body,
    ).model_dump(mode="json")
    comment["project_id"] = project_id  # partition routing
    stamp_create(comment)
    saved = await storage.create(COMMENTS, comment)
    await _bump_thread(thread, delta=1)
    return ArtifactComment(**saved)


@router.delete("/{project_id}/artifacts/{artifact_id}/comments/{comment_id}")
async def delete_comment(project_id: str, artifact_id: str, comment_id: str) -> dict:
    storage = get_storage_provider()
    existing = await storage.get(COMMENTS, comment_id)
    if not existing or existing.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    thread = await _get_or_create_thread(project_id, artifact_id)
    if existing.get("thread_id") != thread["id"]:
        raise HTTPException(status_code=400, detail="Comment is not on this artifact")
    await storage.delete(COMMENTS, comment_id)
    await _bump_thread(thread, delta=-1)
    return {"deleted": True, "id": comment_id}


@router.post("/{project_id}/artifacts/{artifact_id}/chat")
async def chat_about_artifact(project_id: str, artifact_id: str, payload: ChatTurnCreate) -> dict:
    """Grounded per-artifact chat. Stores user + assistant pair atomically."""
    question = payload.body.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Message is required")

    storage = get_storage_provider()
    art = await _load_artifact(project_id, artifact_id)
    thread = await _get_or_create_thread(project_id, artifact_id)
    history = await _list_comments(thread["id"])

    artifact_block = render_artifact_for_prompt(art)
    context_block = await render_engagement_context(project_id)
    history_block = render_history(history)

    user_prompt_parts = ["## Engagement context", context_block or "_(none yet)_"]
    user_prompt_parts += ["", "## Artifact", artifact_block]
    if history_block:
        user_prompt_parts += ["", "## Conversation so far", history_block]
    user_prompt_parts += ["", "## New question", question]
    user_prompt = "\n".join(user_prompt_parts)

    llm = get_llm_provider()
    try:
        reply = await llm.complete(CHAT_SYSTEM, user_prompt)
    except Exception:
        logger.exception("LLM call failed for artifact chat")
        raise HTTPException(status_code=502, detail="AI service unavailable") from None

    turn_id = str(uuid.uuid4())
    author = payload.author or user_label(current_user.get())

    user_comment = ArtifactComment(
        id=str(uuid.uuid4()),
        thread_id=thread["id"],
        role=CommentRole.USER,
        author=author,
        body=question,
        turn_id=turn_id,
    ).model_dump(mode="json")
    user_comment["project_id"] = project_id
    stamp_create(user_comment)
    saved_user = await storage.create(COMMENTS, user_comment)

    asst_comment = ArtifactComment(
        id=str(uuid.uuid4()),
        thread_id=thread["id"],
        role=CommentRole.ASSISTANT,
        author="ai",
        body=(reply or "").strip(),
        turn_id=turn_id,
        model=getattr(llm, "model", "") or "",
    ).model_dump(mode="json")
    asst_comment["project_id"] = project_id
    stamp_create(asst_comment)
    saved_asst = await storage.create(COMMENTS, asst_comment)

    await _bump_thread(thread, delta=2)
    return {
        "turn_id": turn_id,
        "user": ArtifactComment(**saved_user),
        "assistant": ArtifactComment(**saved_asst),
    }
