"""Phase 8 tests for /api/insights/inbox."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_discovery(
    discovery_id: str,
    *,
    engagement_id: str = "",
    assumptions: list[dict] | None = None,
) -> None:
    storage = get_storage_provider()
    payload: dict = {
        "id": discovery_id,
        "name": "T",
        "mode": "standard",
        "current_phase": "capture",
        "stakeholders": [],
        "assumptions": assumptions or [],
        "solution_matches": [],
        "evidence": [],
    }
    if engagement_id:
        payload["engagement_id"] = engagement_id
    await storage.create("discoveries", payload)


async def test_inbox_404_missing_discovery(client: AsyncClient) -> None:
    resp = await client.get("/api/insights/inbox", params={"discovery_id": "nope"})
    assert resp.status_code == 404


async def test_inbox_empty_when_nothing_open(client: AsyncClient) -> None:
    await _seed_discovery("d-empty")
    resp = await client.get("/api/insights/inbox", params={"discovery_id": "d-empty"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["open_questions"] == []
    assert body["unvalidated_assumptions"] == []
    assert body["recent_comments"] == []


async def test_inbox_pulls_open_questions_from_latest_set_per_phase(
    client: AsyncClient,
) -> None:
    """Two question sets in the same phase → only the latest contributes."""
    await _seed_discovery("d-q")
    storage = get_storage_provider()
    await storage.create(
        "question_sets",
        {
            "id": "qs-old",
            "discovery_id": "d-q",
            "phase": "orchestrate",
            "questions": [{"text": "old Q", "purpose": ""}],
            "created_at": "2024-01-01T00:00:00Z",
            "context": "",
        },
    )
    await storage.create(
        "question_sets",
        {
            "id": "qs-new",
            "discovery_id": "d-q",
            "phase": "orchestrate",
            "questions": [
                {"text": "new Q1", "purpose": "a"},
                {"text": "new Q2", "purpose": "b"},
            ],
            "created_at": "2026-05-11T00:00:00Z",
            "context": "",
        },
    )
    resp = await client.get("/api/insights/inbox", params={"discovery_id": "d-q"})
    qs = resp.json()["open_questions"]
    texts = sorted(q["text"] for q in qs)
    assert texts == ["new Q1", "new Q2"]


async def test_inbox_skips_validated_assumptions(client: AsyncClient) -> None:
    await _seed_discovery(
        "d-a",
        assumptions=[
            {"id": "a1", "statement": "one", "confidence": "validated"},
            {"id": "a2", "statement": "two", "confidence": "assumed"},
            {"id": "a3", "statement": "three", "confidence": "conflicting"},
        ],
    )
    resp = await client.get("/api/insights/inbox", params={"discovery_id": "d-a"})
    out = resp.json()["unvalidated_assumptions"]
    statements = sorted(a["statement"] for a in out)
    assert statements == ["three", "two"]


async def test_inbox_recent_comments_capped_at_10(client: AsyncClient) -> None:
    """When more than 10 artifact comments exist for a project, only the
    most recent 10 are returned, newest first."""
    await _seed_discovery("d-c", engagement_id="proj-c")
    storage = get_storage_provider()
    for i in range(15):
        await storage.create(
            "artifact_comments",
            {
                "id": f"c-{i:02d}",
                "thread_id": "t-1",
                "artifact_id": "art-1",
                "project_id": "proj-c",
                "role": "user",
                "author": "tester",
                "body": f"comment {i}",
                "created_at": f"2026-05-11T00:{i:02d}:00Z",
            },
        )
    resp = await client.get("/api/insights/inbox", params={"discovery_id": "d-c"})
    out = resp.json()["recent_comments"]
    assert len(out) == 10
    assert out[0]["body"] == "comment 14"
    assert out[9]["body"] == "comment 5"
