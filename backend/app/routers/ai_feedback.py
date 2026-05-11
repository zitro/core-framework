"""User feedback on AI-generated artifacts.

Lets users leave running notes on AI output — per-discovery, scoped by
``surface`` (problem / usecase / narrative / grounded / questions) and
optionally by ``item_key`` for per-item iteration loops.

Feedback persists via the configured storage provider, so the same
shape works for local filesystem and Azure Cosmos without changes.

Routes (mounted at ``/api/ai-feedback``):
  GET    /?discovery_id=...&surface=...&item_key=...   list feedback
  POST   /                                             create feedback
  DELETE /{feedback_id}                                remove feedback
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
from app.utils.audit import current_user, stamp_create, user_label

router = APIRouter(dependencies=[Depends(get_current_user)])

COLLECTION = "ai_feedback"

Surface = Literal["problem", "usecase", "narrative", "grounded", "questions"]


class FeedbackRecord(BaseModel):
    id: str
    project_id: str = ""
    discovery_id: str
    surface: Surface
    item_key: str | None = None
    feedback: str
    author: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class FeedbackCreate(BaseModel):
    discovery_id: str
    surface: Surface
    item_key: str | None = None
    feedback: str = Field(min_length=1, max_length=4000)


@router.get("", response_model=list[FeedbackRecord])
async def list_feedback(
    discovery_id: str = Query(...),
    surface: Surface = Query(...),
    item_key: str | None = Query(None),
) -> list[FeedbackRecord]:
    """List feedback for a discovery + surface (and optional item)."""
    storage = get_storage_provider()
    query: dict = {"discovery_id": discovery_id, "surface": surface}
    if item_key is not None:
        query["item_key"] = item_key
    items = await storage.list(COLLECTION, query)
    items.sort(key=lambda r: r.get("created_at", ""))
    return [FeedbackRecord(**i) for i in items]


@router.post("", response_model=FeedbackRecord)
async def create_feedback(payload: FeedbackCreate) -> FeedbackRecord:
    """Save a new feedback entry."""
    storage = get_storage_provider()
    record = FeedbackRecord(
        id=str(uuid.uuid4()),
        discovery_id=payload.discovery_id,
        surface=payload.surface,
        item_key=payload.item_key,
        feedback=payload.feedback.strip(),
        author=user_label(current_user.get()),
    ).model_dump(mode="json")
    stamp_create(record)
    saved = await storage.create(COLLECTION, record)
    return FeedbackRecord(**saved)


@router.delete("/{feedback_id}")
async def delete_feedback(feedback_id: str) -> dict:
    storage = get_storage_provider()
    existing = await storage.get(COLLECTION, feedback_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Feedback not found")
    await storage.delete(COLLECTION, feedback_id)
    return {"deleted": True, "id": feedback_id}
