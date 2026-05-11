"""Shape tests for the ArtifactThread / ArtifactComment models."""

from __future__ import annotations

import pytest

from app.models.artifact_thread import (
    ArtifactComment,
    ArtifactThread,
    ChatTurnCreate,
    CommentCreate,
    CommentRole,
)


def test_thread_defaults() -> None:
    t = ArtifactThread(project_id="p1", artifact_id="a1")
    assert t.comment_count == 0
    assert t.title == ""
    assert t.id == ""


def test_comment_default_role_is_user() -> None:
    c = ArtifactComment(thread_id="t1", body="some note")
    assert c.role is CommentRole.USER
    assert c.tokens_in == 0
    assert c.tokens_out == 0


def test_comment_assistant_payload_round_trips() -> None:
    c = ArtifactComment(
        thread_id="t1",
        role=CommentRole.ASSISTANT,
        body="LLM reply",
        turn_id="turn-123",
        model="gpt-4o",
        tokens_in=100,
        tokens_out=50,
    )
    dumped = c.model_dump(mode="json")
    reborn = ArtifactComment.model_validate(dumped)
    assert reborn.role is CommentRole.ASSISTANT
    assert reborn.turn_id == "turn-123"
    assert reborn.tokens_in == 100


@pytest.mark.parametrize("role", ["user", "system"])
def test_comment_create_accepts_user_or_system(role: str) -> None:
    payload = CommentCreate(body="note", role=role)  # type: ignore[arg-type]
    assert payload.role == role


def test_comment_create_rejects_assistant_role() -> None:
    """Assistant turns can only be authored by the AI flow, not posted directly."""
    with pytest.raises(ValueError):
        CommentCreate(body="not allowed", role="assistant")  # type: ignore[arg-type]


def test_chat_turn_create_minimal() -> None:
    payload = ChatTurnCreate(body="why is this an issue?")
    assert payload.author == ""
