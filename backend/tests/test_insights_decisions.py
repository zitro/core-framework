"""Phase 8 tests for /api/insights/decisions."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_discovery(discovery_id: str) -> None:
    storage = get_storage_provider()
    await storage.create(
        "discoveries",
        {
            "id": discovery_id,
            "name": "T",
            "mode": "standard",
            "current_phase": "capture",
            "stakeholders": [],
            "assumptions": [],
            "solution_matches": [],
            "evidence": [],
        },
    )


async def _seed_evidence(
    discovery_id: str,
    evidence_id: str,
    *,
    tags: list[str],
    content: str = "we decided X",
    phase: str = "capture",
    created_at: str = "2026-05-11T00:00:00Z",
) -> None:
    storage = get_storage_provider()
    await storage.create(
        "evidence",
        {
            "id": evidence_id,
            "discovery_id": discovery_id,
            "phase": phase,
            "content": content,
            "source": "Decision",
            "evidence_type": "insight",
            "tags": tags,
            "confidence": "unknown",
            "created_at": created_at,
        },
    )


async def test_decisions_404_missing_discovery(client: AsyncClient) -> None:
    resp = await client.get("/api/insights/decisions", params={"discovery_id": "nope"})
    assert resp.status_code == 404


async def test_decisions_empty_when_no_evidence(client: AsyncClient) -> None:
    await _seed_discovery("d-empty")
    resp = await client.get("/api/insights/decisions", params={"discovery_id": "d-empty"})
    body = resp.json()
    assert body["total"] == 0
    assert body["decisions"] == []


async def test_decisions_filters_to_decision_tag_only(client: AsyncClient) -> None:
    """Evidence tagged 'decision' is included; others are skipped."""
    await _seed_discovery("d-1")
    await _seed_evidence("d-1", "ev-1", tags=["decision"], content="ship on Friday")
    await _seed_evidence("d-1", "ev-2", tags=["note"], content="just a note")
    await _seed_evidence(
        "d-1",
        "ev-3",
        tags=["context", "decision"],
        content="default region is us-east",
    )

    resp = await client.get("/api/insights/decisions", params={"discovery_id": "d-1"})
    body = resp.json()
    assert body["total"] == 2
    texts = sorted(d["text"] for d in body["decisions"])
    assert texts == ["default region is us-east", "ship on Friday"]


async def test_decisions_newest_first(client: AsyncClient) -> None:
    await _seed_discovery("d-2")
    await _seed_evidence(
        "d-2",
        "older",
        tags=["decision"],
        content="older decision",
        created_at="2026-05-01T00:00:00Z",
    )
    await _seed_evidence(
        "d-2",
        "newer",
        tags=["decision"],
        content="newer decision",
        created_at="2026-05-11T00:00:00Z",
    )
    resp = await client.get("/api/insights/decisions", params={"discovery_id": "d-2"})
    body = resp.json()
    assert [d["text"] for d in body["decisions"]] == ["newer decision", "older decision"]


async def test_decisions_tag_match_is_case_insensitive(client: AsyncClient) -> None:
    await _seed_discovery("d-3")
    await _seed_evidence("d-3", "ev-1", tags=["Decision"], content="capital D")
    resp = await client.get("/api/insights/decisions", params={"discovery_id": "d-3"})
    assert resp.json()["total"] == 1
