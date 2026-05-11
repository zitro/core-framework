"""Phase 8 tests for /api/insights/search."""

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


async def test_search_404_missing_discovery(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/insights/search", params={"discovery_id": "nope", "q": "hi"}
    )
    assert resp.status_code == 404


async def test_search_requires_query(client: AsyncClient) -> None:
    await _seed_discovery("d-1")
    resp = await client.get("/api/insights/search", params={"discovery_id": "d-1", "q": ""})
    assert resp.status_code == 422


async def test_search_finds_evidence_match(client: AsyncClient) -> None:
    await _seed_discovery("d-1")
    storage = get_storage_provider()
    await storage.create(
        "evidence",
        {
            "id": "ev-1",
            "discovery_id": "d-1",
            "phase": "capture",
            "content": "Claims agents juggle three different tools",
            "source": "intake call",
            "evidence_type": "quote",
            "tags": [],
            "confidence": "unknown",
        },
    )
    await storage.create(
        "evidence",
        {
            "id": "ev-2",
            "discovery_id": "d-1",
            "phase": "capture",
            "content": "Onboarding takes two weeks",
            "source": "interview",
            "evidence_type": "observation",
            "tags": [],
            "confidence": "unknown",
        },
    )
    resp = await client.get(
        "/api/insights/search", params={"discovery_id": "d-1", "q": "claims"}
    )
    body = resp.json()
    assert body["total"] == 1
    assert body["hits"][0]["kind"] == "evidence"
    assert "Claims" in body["hits"][0]["snippet"]


async def test_search_ranks_higher_scores_first(client: AsyncClient) -> None:
    """Row with more term occurrences ranks higher."""
    await _seed_discovery("d-2")
    storage = get_storage_provider()
    await storage.create(
        "evidence",
        {
            "id": "low",
            "discovery_id": "d-2",
            "phase": "capture",
            "content": "claims",
            "source": "x",
            "evidence_type": "general",
            "tags": [],
            "confidence": "unknown",
        },
    )
    await storage.create(
        "evidence",
        {
            "id": "high",
            "discovery_id": "d-2",
            "phase": "capture",
            "content": "claims claims claims",
            "source": "y",
            "evidence_type": "general",
            "tags": [],
            "confidence": "unknown",
        },
    )
    resp = await client.get(
        "/api/insights/search", params={"discovery_id": "d-2", "q": "claims"}
    )
    body = resp.json()
    assert body["hits"][0]["score"] > body["hits"][1]["score"]


async def test_search_across_collections(client: AsyncClient) -> None:
    """Search hits evidence + briefs + problem statements + comments."""
    await _seed_discovery("d-3", engagement_id="proj-3")
    storage = get_storage_provider()
    await storage.create(
        "evidence",
        {
            "id": "ev-1",
            "discovery_id": "d-3",
            "phase": "capture",
            "content": "compliance pain",
            "source": "x",
            "evidence_type": "general",
            "tags": [],
            "confidence": "unknown",
        },
    )
    await storage.create(
        "problem_statements",
        {
            "id": "ps-1",
            "discovery_id": "d-3",
            "version": 1,
            "who": "",
            "what": "compliance reporting takes weeks",
            "why": "",
            "impact": "",
            "statement": "",
            "user_instructions": "",
            "context_used": "",
        },
    )
    await storage.create(
        "artifact_comments",
        {
            "id": "c-1",
            "thread_id": "t-1",
            "artifact_id": "a-1",
            "project_id": "proj-3",
            "role": "user",
            "author": "tester",
            "body": "we should escalate the compliance issue",
            "created_at": "2026-05-11T00:00:00Z",
        },
    )
    resp = await client.get(
        "/api/insights/search", params={"discovery_id": "d-3", "q": "compliance"}
    )
    body = resp.json()
    kinds = {h["kind"] for h in body["hits"]}
    assert {"evidence", "problem", "comment"}.issubset(kinds)


async def test_search_no_matches_returns_empty(client: AsyncClient) -> None:
    await _seed_discovery("d-4")
    resp = await client.get(
        "/api/insights/search", params={"discovery_id": "d-4", "q": "asdfzxcvbnm"}
    )
    assert resp.json()["hits"] == []
