"""Phase 6E router tests for /chat + /questions endpoints."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_project(project_id: str, local_dir: str | None = None) -> None:
    storage = get_storage_provider()
    payload: dict[str, Any] = {
        "id": project_id,
        "name": "Test",
        "customer": "Acme",
        "status": "proposed",
        "owners": [],
    }
    if local_dir:
        payload["metadata"] = {"local_dirs": [local_dir]}
    await storage.create("engagements", payload)


# ── /chat ───────────────────────────────────────────────────────────────


class _ChatLLM:
    async def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return {
            "answer": "Onboarding takes 6 weeks today.",
            "citations": [],
            "follow_up_questions": ["What's the bottleneck?"],
        }


async def test_chat_404_when_project_missing(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/synthesis/missing/chat",
        json={"session_id": "s1", "message": "hi"},
    )
    assert resp.status_code == 404


async def test_chat_returns_reply_and_persists_two_turns(client: AsyncClient, tmp_path) -> None:
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")
    await _seed_project("proj-chat-1", local_dir=str(corpus_dir))

    with patch("app.synthesis.chat.get_llm_provider", return_value=_ChatLLM()):
        resp = await client.post(
            "/api/synthesis/proj-chat-1/chat",
            json={"session_id": "session-A", "message": "How long is onboarding?"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == "session-A"
    assert body["answer"].startswith("Onboarding")
    assert body["follow_up_questions"] == ["What's the bottleneck?"]

    # Two turns persisted (user + assistant)
    listing = await client.get("/api/synthesis/proj-chat-1/chat?session_id=session-A")
    turns = listing.json()["turns"]
    assert len(turns) == 2
    assert [t["role"] for t in turns] == ["user", "assistant"]


async def test_chat_history_carries_across_turns(client: AsyncClient, tmp_path) -> None:
    """Second turn's history should contain the first turn (user + assistant)."""
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")
    await _seed_project("proj-chat-2", local_dir=str(corpus_dir))

    received: list[str] = []

    class _Capture:
        async def complete_json(self, system: str, user: str) -> dict[str, Any]:
            received.append(user)
            return {"answer": "ok", "citations": [], "follow_up_questions": []}

    with patch("app.synthesis.chat.get_llm_provider", return_value=_Capture()):
        await client.post(
            "/api/synthesis/proj-chat-2/chat",
            json={"session_id": "s1", "message": "first question"},
        )
        await client.post(
            "/api/synthesis/proj-chat-2/chat",
            json={"session_id": "s1", "message": "second question"},
        )

    assert len(received) == 2
    # Second prompt should reference the first message in its history block.
    assert "first question" in received[1]


async def test_chat_list_empty_for_unused_project(client: AsyncClient) -> None:
    await _seed_project("proj-chat-empty")
    resp = await client.get("/api/synthesis/proj-chat-empty/chat")
    assert resp.status_code == 200
    assert resp.json() == {"turns": []}


# ── /questions ──────────────────────────────────────────────────────────


class _QuestionsLLM:
    async def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return {
            "questions": [
                {
                    "text": "What's the current onboarding workflow?",
                    "rationale": "Need baseline to compare against.",
                    "target_artifact_type_id": "problem-statement",
                    "priority": 1,
                },
                {
                    "text": "Who owns the intake step?",
                    "rationale": "",
                    "target_artifact_type_id": "",
                    "priority": 3,
                },
            ]
        }


async def test_questions_list_empty_for_new_project(client: AsyncClient) -> None:
    await _seed_project("proj-q-empty")
    resp = await client.get("/api/synthesis/proj-q-empty/questions")
    assert resp.status_code == 200
    assert resp.json() == {"questions": []}


async def test_questions_refresh_persists_and_sorts(client: AsyncClient, tmp_path) -> None:
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")
    await _seed_project("proj-q-refresh", local_dir=str(corpus_dir))

    with patch("app.synthesis.question_agent.get_llm_provider", return_value=_QuestionsLLM()):
        resp = await client.post("/api/synthesis/proj-q-refresh/questions/refresh")

    assert resp.status_code == 200
    body = resp.json()
    assert body["question_count"] == 2
    # priority=1 comes before priority=3
    assert body["questions"][0]["priority"] == 1
    assert body["questions"][1]["priority"] == 3

    # Listing should match
    listing = await client.get("/api/synthesis/proj-q-refresh/questions")
    assert listing.json()["questions"][0]["priority"] == 1


async def test_questions_refresh_404_when_project_missing(
    client: AsyncClient,
) -> None:
    resp = await client.post("/api/synthesis/missing/questions/refresh")
    assert resp.status_code == 404


async def test_questions_refresh_replaces_unanswered_but_keeps_answered(
    client: AsyncClient, tmp_path
) -> None:
    """Answered questions must survive a refresh; unanswered ones are
    swept and replaced with the fresh batch."""
    corpus_dir = tmp_path / "corpus"
    corpus_dir.mkdir()
    (corpus_dir / "x.md").write_text("text\n", encoding="utf-8")
    await _seed_project("proj-q-replace", local_dir=str(corpus_dir))

    # Hand-place one answered question and one unanswered.
    storage = get_storage_provider()
    await storage.create(
        "synthesis_questions",
        {
            "id": "answered-keep",
            "project_id": "proj-q-replace",
            "text": "Settled question",
            "answered": True,
            "answer": "Yes.",
            "priority": 2,
        },
    )
    await storage.create(
        "synthesis_questions",
        {
            "id": "unanswered-sweep",
            "project_id": "proj-q-replace",
            "text": "Pending question",
            "answered": False,
            "priority": 2,
        },
    )

    with patch("app.synthesis.question_agent.get_llm_provider", return_value=_QuestionsLLM()):
        await client.post("/api/synthesis/proj-q-replace/questions/refresh")

    # Survivors: 1 answered + 2 fresh = 3 total
    listing = await client.get("/api/synthesis/proj-q-replace/questions")
    items = listing.json()["questions"]
    assert len(items) == 3
    ids = {q.get("id") for q in items}
    assert "answered-keep" in ids
    assert "unanswered-sweep" not in ids
