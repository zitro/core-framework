"""Phase 8 tests for /api/insights/stakeholders."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_discovery(
    discovery_id: str,
    *,
    stakeholders: list[dict] | None = None,
    engagement_id: str = "",
) -> None:
    storage = get_storage_provider()
    payload: dict = {
        "id": discovery_id,
        "name": "T",
        "mode": "standard",
        "current_phase": "capture",
        "stakeholders": stakeholders or [],
        "assumptions": [],
        "solution_matches": [],
        "evidence": [],
    }
    if engagement_id:
        payload["engagement_id"] = engagement_id
    await storage.create("discoveries", payload)


async def test_stakeholders_404_when_discovery_missing(client: AsyncClient) -> None:
    resp = await client.get("/api/insights/stakeholders", params={"discovery_id": "nope"})
    assert resp.status_code == 404


async def test_stakeholders_empty_when_none_captured(client: AsyncClient) -> None:
    await _seed_discovery("d-empty")
    resp = await client.get("/api/insights/stakeholders", params={"discovery_id": "d-empty"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["by_org"] == {}


async def test_stakeholders_rolled_up_from_discovery_record(client: AsyncClient) -> None:
    await _seed_discovery(
        "d-1",
        stakeholders=[
            {"name": "Sarah", "role": "VP Ops", "org": "Acme", "influence": "high"},
            {"name": "Marcus", "role": "Engineer", "org": "Acme", "influence": "medium"},
            {"name": "Lin", "role": "Sponsor", "org": "Contoso", "influence": "high"},
        ],
    )
    resp = await client.get("/api/insights/stakeholders", params={"discovery_id": "d-1"})
    body = resp.json()
    assert body["total"] == 3
    assert sorted(body["by_org"].keys()) == ["Acme", "Contoso"]
    assert len(body["by_org"]["Acme"]) == 2


async def test_stakeholders_merge_with_engagement_context_deduped(
    client: AsyncClient,
) -> None:
    """When the discovery and engagement_context both list a stakeholder,
    the dup is collapsed by (name, role)."""
    await _seed_discovery(
        "d-2",
        engagement_id="proj-2",
        stakeholders=[{"name": "Sarah", "role": "VP Ops", "org": "Acme"}],
    )
    storage = get_storage_provider()
    await storage.create(
        "engagement_contexts",
        {
            "id": "ec-1",
            "project_id": "proj-2",
            "title": "",
            "phase": "discovery",
            "stakeholders": [
                {"name": "Sarah", "role": "VP Ops", "org": "Acme", "influence": "high"},
                {"name": "Jamie", "role": "PM", "org": "Acme", "influence": "medium"},
            ],
        },
    )
    resp = await client.get("/api/insights/stakeholders", params={"discovery_id": "d-2"})
    body = resp.json()
    assert body["total"] == 2  # Sarah merged
    acme = body["by_org"]["Acme"]
    names = sorted(p["name"] for p in acme)
    assert names == ["Jamie", "Sarah"]


async def test_stakeholders_skips_unnamed(client: AsyncClient) -> None:
    """Stakeholders with empty/missing name are skipped."""
    await _seed_discovery(
        "d-3",
        stakeholders=[
            {"name": "", "role": "ghost"},
            {"role": "ghost-no-name"},
            {"name": "  ", "role": "spaces only"},
            {"name": "Real", "role": "human"},
        ],
    )
    resp = await client.get("/api/insights/stakeholders", params={"discovery_id": "d-3"})
    body = resp.json()
    assert body["total"] == 1
    assert body["by_org"]["Unspecified"][0]["name"] == "Real"
