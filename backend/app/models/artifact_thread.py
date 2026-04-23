"""Thread + comments attached to a specific Artifact.

Each Artifact has at most one Thread; a Thread holds an ordered list of
Comments. Comments can be human notes or AI chat turns. Per-card chat is
a Comment with ``role`` ∈ {user, assistant} and a stable ``turn`` id, so
a chat conversation is just a slice of the thread filtered by role.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(UTC)


class CommentRole(StrEnum):
    USER = "user"  # human note or chat turn
    ASSISTANT = "assistant"  # AI chat turn
    SYSTEM = "system"  # system-injected event (regenerated, status change)


class ArtifactComment(BaseModel):
    """A single comment / chat turn on an Artifact thread."""

    id: str = ""
    thread_id: str
    role: CommentRole = CommentRole.USER
    author: str = ""  # display name; "" for system / current user fallback
    body: str  # markdown
    # Optional grouping for chat turns (same turn_id pairs user+assistant)
    turn_id: str = ""
    # When role=assistant, surface model + token spend for transparency
    model: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    created_at: datetime = Field(default_factory=_utcnow)


class ArtifactThread(BaseModel):
    """Conversation/notes attached to a single Artifact."""

    id: str = ""
    project_id: str  # partition key
    artifact_id: str  # FK -> Artifact.id
    title: str = ""  # optional, defaults to artifact title client-side
    comment_count: int = 0
    last_activity_at: datetime = Field(default_factory=_utcnow)
    created_at: datetime = Field(default_factory=_utcnow)


class CommentCreate(BaseModel):
    """Payload for posting a human note to a thread."""

    body: str
    role: Literal["user", "system"] = "user"
    author: str = ""


class ChatTurnCreate(BaseModel):
    """Payload for asking the AI about an artifact.

    The router builds a grounded prompt from artifact + thread history +
    engagement context, calls the LLM, and stores both the user turn and
    the assistant reply as paired comments sharing one ``turn_id``.
    """

    body: str
    author: str = ""
