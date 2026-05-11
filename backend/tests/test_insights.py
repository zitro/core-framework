"""Phase 8A tests for /api/insights/coverage."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_discovery(discovery_id: str, *, assumptions: list[dict] | None = None) -> None:
    storage = get_storage_provider()
    await storage.create(
        "discoveries",
        {
            "id": discovery_id,
            "name": "T",
            "mode": "standard",
            "current_phase": "capture",
            "stakeholders": [],
            "assumptions": assumptions or [],
            "solution_matches": [],
            "evidence": [],
        },
    )


async def _seed(collection: str, payload: dict) -> None:
    storage = get_storage_provider()
    await storage.create(collection, payload)


# ── shape + 404 ────────────────────────────────────────────────────────


async def test_coverage_404_for_missing_discovery(client: AsyncClient) -> None:
    resp = await client.get("/api/insights/coverage", params={"discovery_id": "nope"})
    assert resp.status_code == 404


async def test_coverage_returns_all_phases_with_zero_counts(client: AsyncClient) -> None:
    await _seed_discovery("d-empty")
    resp = await client.get("/api/insights/coverage", params={"discovery_id": "d-empty"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["phases"] == ["capture", "orchestrate", "refine", "execute"]
    assert all(c["count"] == 0 for c in body["cells"])
    assert all(c["status"] == "missing" for c in body["cells"])
    assert body["totals"] == {"capture": 0, "orchestrate": 0, "refine": 0, "execute": 0}


# ── per-phase counts ───────────────────────────────────────────────────


async def test_coverage_counts_evidence_per_phase(client: AsyncClient) -> None:
    await _seed_discovery("d-1")
    for _ in range(3):
        await _seed(
            "evidence",
            {
                "id": f"ev-{_}",
                "discovery_id": "d-1",
                "phase": "capture",
                "content": "x",
                "source": "test",
                "evidence_type": "general",
                "tags": [],
                "confidence": "unknown",
            },
        )

    resp = await client.get("/api/insights/coverage", params={"discovery_id": "d-1"})
    body = resp.json()
    capture_evidence = next(
        c for c in body["cells"] if c["phase"] == "capture" and c["label"] == "Evidence"
    )
    assert capture_evidence["count"] == 3
    assert capture_evidence["status"] == "ok"
    assert body["totals"]["capture"] == 3


async def test_coverage_status_thresholds(client: AsyncClient) -> None:
    """0 → missing, 1-2 → draft, 3+ → ok."""
    await _seed_discovery("d-2")
    for i in range(2):
        await _seed(
            "problem_statements",
            {
                "id": f"ps-{i}",
                "discovery_id": "d-2",
                "version": i + 1,
                "who": "",
                "what": "",
                "why": "",
                "impact": "",
                "statement": "",
                "user_instructions": "",
                "context_used": "",
            },
        )
    resp = await client.get("/api/insights/coverage", params={"discovery_id": "d-2"})
    body = resp.json()
    problem = next(c for c in body["cells"] if c["label"] == "Problem statements")
    assert problem["count"] == 2
    assert problem["status"] == "draft"


async def test_coverage_counts_assumptions_from_discovery_record(client: AsyncClient) -> None:
    """Assumptions live on the discovery row, not a separate collection."""
    await _seed_discovery(
        "d-3",
        assumptions=[
            {"id": "a-1", "statement": "x", "confidence": "assumed"},
            {"id": "a-2", "statement": "y", "confidence": "assumed"},
            {"id": "a-3", "statement": "z", "confidence": "validated"},
            {"id": "a-4", "statement": "w", "confidence": "validated"},
        ],
    )
    resp = await client.get("/api/insights/coverage", params={"discovery_id": "d-3"})
    body = resp.json()
    assumptions = next(c for c in body["cells"] if c["label"] == "Assumptions tracked")
    assert assumptions["count"] == 4
    assert assumptions["status"] == "ok"
    assert body["totals"]["refine"] == 4
