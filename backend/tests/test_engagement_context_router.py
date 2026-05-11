"""Phase 6G router tests for /api/engagement-context."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_project(project_id: str) -> None:
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


# ── GET ────────────────────────────────────────────────────────────────


async def test_get_404_when_project_missing(client: AsyncClient) -> None:
    resp = await client.get("/api/engagement-context/missing-id")
    assert resp.status_code == 404


async def test_get_auto_creates_empty_context(client: AsyncClient) -> None:
    """A project with no existing context gets an empty record on
    first GET so the frontend always has something to render."""
    await _seed_project("proj-ctx-new")
    resp = await client.get("/api/engagement-context/proj-ctx-new")
    assert resp.status_code == 200
    body = resp.json()
    assert body["project_id"] == "proj-ctx-new"
    assert body["phase"] == "discovery"  # default
    assert body["title"] == ""
    assert body["scope_in"] == []
    # Same project second time should return the same row (not a new one)
    again = await client.get("/api/engagement-context/proj-ctx-new")
    assert again.json()["id"] == body["id"]


async def test_get_returns_existing_row(client: AsyncClient) -> None:
    await _seed_project("proj-ctx-existing")
    storage = get_storage_provider()
    await storage.create(
        "engagement_contexts",
        {
            "id": "ec_preexisting",
            "project_id": "proj-ctx-existing",
            "title": "Claims rework",
            "phase": "pilot",
            "scope_in": ["intake"],
            "scope_out": ["payouts"],
        },
    )
    resp = await client.get("/api/engagement-context/proj-ctx-existing")
    body = resp.json()
    assert body["id"] == "ec_preexisting"
    assert body["title"] == "Claims rework"
    assert body["phase"] == "pilot"


# ── PUT ────────────────────────────────────────────────────────────────


async def test_put_404_when_project_missing(client: AsyncClient) -> None:
    resp = await client.put(
        "/api/engagement-context/missing-id",
        json={"title": "x"},
    )
    assert resp.status_code == 404


async def test_put_partial_update_preserves_unset_fields(client: AsyncClient) -> None:
    """PUT with only `title` should not blank out other fields."""
    await _seed_project("proj-ctx-partial")

    # First set up baseline.
    await client.put(
        "/api/engagement-context/proj-ctx-partial",
        json={
            "title": "First title",
            "one_liner": "Reduce claims cycle time.",
            "phase": "pilot",
            "scope_in": ["intake", "triage"],
            "risks": ["data quality"],
        },
    )

    # Patch only the title.
    resp = await client.put(
        "/api/engagement-context/proj-ctx-partial",
        json={"title": "Second title"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Second title"
    assert body["one_liner"] == "Reduce claims cycle time."
    assert body["phase"] == "pilot"
    assert body["scope_in"] == ["intake", "triage"]
    assert body["risks"] == ["data quality"]


async def test_put_replaces_list_fields_when_provided(client: AsyncClient) -> None:
    """List fields, when present in the payload, fully replace (not
    append) — matches master's update semantics."""
    await _seed_project("proj-ctx-lists")
    await client.put(
        "/api/engagement-context/proj-ctx-lists",
        json={"scope_in": ["a", "b"]},
    )
    resp = await client.put(
        "/api/engagement-context/proj-ctx-lists",
        json={"scope_in": ["c"]},
    )
    assert resp.json()["scope_in"] == ["c"]


async def test_put_round_trip_with_nested_stakeholder(client: AsyncClient) -> None:
    await _seed_project("proj-ctx-stakeholder")
    resp = await client.put(
        "/api/engagement-context/proj-ctx-stakeholder",
        json={
            "stakeholders": [
                {"name": "Sarah", "role": "VP Ops", "org": "customer", "influence": "high"}
            ]
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["stakeholders"]) == 1
    assert body["stakeholders"][0]["name"] == "Sarah"
    assert body["stakeholders"][0]["influence"] == "high"


async def test_put_no_op_when_payload_empty(client: AsyncClient) -> None:
    """An empty patch is a no-op; returns current state without bumping
    updated_at."""
    await _seed_project("proj-ctx-noop")
    initial = await client.get("/api/engagement-context/proj-ctx-noop")
    initial_updated = initial.json()["updated_at"]

    resp = await client.put("/api/engagement-context/proj-ctx-noop", json={})
    assert resp.status_code == 200
    assert resp.json()["updated_at"] == initial_updated
