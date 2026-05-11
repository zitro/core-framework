"""Phase 8 tests for /api/insights/activity."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_discovery(discovery_id: str, *, engagement_id: str = "") -> None:
    storage = get_storage_provider()
    payload: dict = {
        "id": discovery_id,
        "name": "T",
        "mode": "standard",
        "current_phase": "capture",
        "stakeholders": [],
        "assumptions": [],
        "solution_matches": [],
        "evidence": [],
    }
    if engagement_id:
        payload["engagement_id"] = engagement_id
    await storage.create("discoveries", payload)


async def test_activity_404_missing_discovery(client: AsyncClient) -> None:
    resp = await client.get("/api/insights/activity", params={"discovery_id": "nope"})
    assert resp.status_code == 404


async def test_activity_empty_when_no_events(client: AsyncClient) -> None:
    await _seed_discovery("d-empty")
    resp = await client.get("/api/insights/activity", params={"discovery_id": "d-empty"})
    assert resp.status_code == 200
    assert resp.json()["events"] == []


async def test_activity_combines_multiple_kinds_newest_first(client: AsyncClient) -> None:
    await _seed_discovery("d-1", engagement_id="proj-1")
    storage = get_storage_provider()

    await storage.create(
        "evidence",
        {
            "id": "ev-1",
            "discovery_id": "d-1",
            "phase": "capture",
            "content": "An interview note",
            "source": "test",
            "evidence_type": "quote",
            "tags": [],
            "confidence": "unknown",
            "created_at": "2026-05-11T01:00:00Z",
        },
    )
    await storage.create(
        "problem_statements",
        {
            "id": "ps-1",
            "discovery_id": "d-1",
            "version": 1,
            "who": "x",
            "what": "y",
            "why": "z",
            "impact": "w",
            "statement": "claims agents juggle 3 tools",
            "user_instructions": "",
            "context_used": "",
            "created_at": "2026-05-11T03:00:00Z",
        },
    )
    await storage.create(
        "artifact_comments",
        {
            "id": "c-1",
            "thread_id": "t-1",
            "artifact_id": "a-1",
            "project_id": "proj-1",
            "role": "user",
            "author": "tester",
            "body": "we should focus on intake",
            "created_at": "2026-05-11T02:00:00Z",
        },
    )

    resp = await client.get("/api/insights/activity", params={"discovery_id": "d-1"})
    body = resp.json()
    assert len(body["events"]) == 3
    # Newest-first: problem (03:00) > comment (02:00) > evidence (01:00)
    kinds = [e["kind"] for e in body["events"]]
    assert kinds == ["problem", "comment", "evidence"]


async def test_activity_respects_limit(client: AsyncClient) -> None:
    await _seed_discovery("d-2")
    storage = get_storage_provider()
    for i in range(5):
        await storage.create(
            "evidence",
            {
                "id": f"ev-{i:02d}",
                "discovery_id": "d-2",
                "phase": "capture",
                "content": f"note {i}",
                "source": "test",
                "evidence_type": "general",
                "tags": [],
                "confidence": "unknown",
                "created_at": f"2026-05-11T00:{i:02d}:00Z",
            },
        )
    resp = await client.get(
        "/api/insights/activity", params={"discovery_id": "d-2", "limit": 3}
    )
    assert len(resp.json()["events"]) == 3
