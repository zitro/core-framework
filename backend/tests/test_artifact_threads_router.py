"""Phase 6H router tests for /threads + /comments + /chat."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_project_and_artifact(project_id: str, artifact_id: str) -> None:
    storage = get_storage_provider()
    await storage.create(
        "engagements",
        {
            "id": project_id,
            "name": "Test",
            "customer": "Acme",
            "status": "proposed",
            "owners": [],
        },
    )
    await storage.create(
        "artifacts",
        {
            "id": artifact_id,
            "project_id": project_id,
            "type_id": "problem-statement",
            "category": "why",
            "title": "Claims pain",
            "summary": "Claims agents juggle 3 tools.",
            "body": {"statement": "Claims agents juggle 3 tools."},
            "citations": [],
            "status": "draft",
            "version": 1,
        },
    )


# ── GET /thread ────────────────────────────────────────────────────────


async def test_get_thread_404_on_missing_artifact(client: AsyncClient) -> None:
    resp = await client.get("/api/synthesis/proj-x/artifacts/missing-art/thread")
    assert resp.status_code == 404


async def test_get_thread_auto_creates_on_first_access(client: AsyncClient) -> None:
    await _seed_project_and_artifact("proj-t-1", "art-1")
    resp = await client.get("/api/synthesis/proj-t-1/artifacts/art-1/thread")
    assert resp.status_code == 200
    body = resp.json()
    assert body["thread"]["artifact_id"] == "art-1"
    assert body["thread"]["project_id"] == "proj-t-1"
    assert body["thread"]["title"] == "Claims pain"
    assert body["comments"] == []


async def test_get_thread_returns_existing(client: AsyncClient) -> None:
    """Two GETs in a row return the same thread id, not a new one each time."""
    await _seed_project_and_artifact("proj-t-2", "art-2")
    first = await client.get("/api/synthesis/proj-t-2/artifacts/art-2/thread")
    second = await client.get("/api/synthesis/proj-t-2/artifacts/art-2/thread")
    assert first.json()["thread"]["id"] == second.json()["thread"]["id"]


# ── POST /comments ─────────────────────────────────────────────────────


async def test_post_comment_persists_and_bumps_count(client: AsyncClient) -> None:
    await _seed_project_and_artifact("proj-c-1", "art-c1")
    resp = await client.post(
        "/api/synthesis/proj-c-1/artifacts/art-c1/comments",
        json={"body": "this needs a clearer evidence trail", "role": "user"},
    )
    assert resp.status_code == 200
    comment = resp.json()
    assert comment["role"] == "user"
    assert comment["body"] == "this needs a clearer evidence trail"

    # Thread comment_count should bump to 1.
    thread = await client.get("/api/synthesis/proj-c-1/artifacts/art-c1/thread")
    assert thread.json()["thread"]["comment_count"] == 1
    assert len(thread.json()["comments"]) == 1


async def test_post_comment_rejects_empty_body(client: AsyncClient) -> None:
    await _seed_project_and_artifact("proj-c-2", "art-c2")
    resp = await client.post(
        "/api/synthesis/proj-c-2/artifacts/art-c2/comments",
        json={"body": "   ", "role": "user"},
    )
    # Pydantic validates min_length first → 422
    assert resp.status_code in (200, 422)
    if resp.status_code == 200:
        # If Pydantic didn't catch it, the handler should
        assert False, "empty body should not have been accepted"


async def test_post_comment_rejects_assistant_role(client: AsyncClient) -> None:
    """Assistant role is reserved for the AI flow. CommentCreate Literal
    blocks it at Pydantic validation."""
    await _seed_project_and_artifact("proj-c-3", "art-c3")
    resp = await client.post(
        "/api/synthesis/proj-c-3/artifacts/art-c3/comments",
        json={"body": "I'm the AI!", "role": "assistant"},
    )
    assert resp.status_code == 422


# ── DELETE /comments/{id} ──────────────────────────────────────────────


async def test_delete_comment_round_trip(client: AsyncClient) -> None:
    await _seed_project_and_artifact("proj-d-1", "art-d1")
    add = await client.post(
        "/api/synthesis/proj-d-1/artifacts/art-d1/comments",
        json={"body": "going away", "role": "user"},
    )
    comment_id = add.json()["id"]

    delete = await client.delete(f"/api/synthesis/proj-d-1/artifacts/art-d1/comments/{comment_id}")
    assert delete.status_code == 200
    assert delete.json()["deleted"] is True

    thread = await client.get("/api/synthesis/proj-d-1/artifacts/art-d1/thread")
    assert thread.json()["thread"]["comment_count"] == 0


async def test_delete_comment_404_on_missing(client: AsyncClient) -> None:
    await _seed_project_and_artifact("proj-d-2", "art-d2")
    resp = await client.delete("/api/synthesis/proj-d-2/artifacts/art-d2/comments/does-not-exist")
    assert resp.status_code == 404


# ── POST /chat ─────────────────────────────────────────────────────────


class _PlainLLM:
    """LLM whose .complete() returns a fixed prose reply.
    Per-artifact chat uses .complete() (not complete_json) since the
    response is plain text."""

    async def complete(self, system: str, user: str) -> str:
        return "The current evidence supports the claim about onboarding."


async def test_chat_404_on_missing_artifact(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/synthesis/proj-x/artifacts/missing-art/chat",
        json={"body": "hi"},
    )
    assert resp.status_code == 404


async def test_chat_creates_user_and_assistant_pair(client: AsyncClient) -> None:
    await _seed_project_and_artifact("proj-chat", "art-chat")
    with patch("app.routers.artifact_threads.get_llm_provider", return_value=_PlainLLM()):
        resp = await client.post(
            "/api/synthesis/proj-chat/artifacts/art-chat/chat",
            json={"body": "is this well-grounded?"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["role"] == "user"
    assert body["user"]["body"] == "is this well-grounded?"
    assert body["assistant"]["role"] == "assistant"
    assert body["assistant"]["body"].startswith("The current evidence")
    # Same turn_id pairs them
    assert body["user"]["turn_id"] == body["assistant"]["turn_id"] == body["turn_id"]

    # Thread count bumped by 2.
    thread = await client.get("/api/synthesis/proj-chat/artifacts/art-chat/thread")
    assert thread.json()["thread"]["comment_count"] == 2


async def test_chat_returns_502_when_llm_fails(client: AsyncClient) -> None:
    await _seed_project_and_artifact("proj-chat-err", "art-chat-err")

    class _BrokenLLM:
        async def complete(self, system: str, user: str) -> str:
            raise RuntimeError("provider down")

    with patch("app.routers.artifact_threads.get_llm_provider", return_value=_BrokenLLM()):
        resp = await client.post(
            "/api/synthesis/proj-chat-err/artifacts/art-chat-err/chat",
            json={"body": "hi"},
        )
    assert resp.status_code == 502


async def test_chat_includes_history_in_prompt(client: AsyncClient) -> None:
    """Second chat turn should see the first user message + first
    assistant reply rendered into the prompt body."""
    await _seed_project_and_artifact("proj-hist", "art-hist")

    captured: list[str] = []

    class _Capture:
        async def complete(self, system: str, user: str) -> str:
            captured.append(user)
            return "ok"

    with patch("app.routers.artifact_threads.get_llm_provider", return_value=_Capture()):
        await client.post(
            "/api/synthesis/proj-hist/artifacts/art-hist/chat",
            json={"body": "first question about evidence"},
        )
        await client.post(
            "/api/synthesis/proj-hist/artifacts/art-hist/chat",
            json={"body": "second question"},
        )

    assert len(captured) == 2
    second_prompt = captured[1]
    assert "Conversation so far" in second_prompt
    assert "first question about evidence" in second_prompt
