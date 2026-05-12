"""Tests for /api/ai-feedback — user feedback on AI-generated artifacts."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_then_list_feedback(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/ai-feedback",
        json={
            "discovery_id": "d-1",
            "surface": "problem",
            "feedback": "Too generic. Anchor on claims-cycle time.",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["surface"] == "problem"
    assert body["discovery_id"] == "d-1"
    assert body["item_key"] is None

    listed = await client.get(
        "/api/ai-feedback", params={"discovery_id": "d-1", "surface": "problem"}
    )
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["feedback"].startswith("Too generic")


async def test_list_scoped_by_surface(client: AsyncClient) -> None:
    """Feedback on different surfaces does not bleed across."""
    for surface in ("problem", "narrative", "grounded"):
        await client.post(
            "/api/ai-feedback",
            json={"discovery_id": "d-2", "surface": surface, "feedback": f"on {surface}"},
        )

    resp = await client.get(
        "/api/ai-feedback", params={"discovery_id": "d-2", "surface": "narrative"}
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["feedback"] == "on narrative"


async def test_list_scoped_by_item_key(client: AsyncClient) -> None:
    """item_key filter narrows the list to one item's feedback."""
    await client.post(
        "/api/ai-feedback",
        json={
            "discovery_id": "d-3",
            "surface": "usecase",
            "item_key": "uc-1",
            "feedback": "case A",
        },
    )
    await client.post(
        "/api/ai-feedback",
        json={
            "discovery_id": "d-3",
            "surface": "usecase",
            "item_key": "uc-2",
            "feedback": "case B",
        },
    )

    listed_a = await client.get(
        "/api/ai-feedback",
        params={"discovery_id": "d-3", "surface": "usecase", "item_key": "uc-1"},
    )
    assert [r["feedback"] for r in listed_a.json()] == ["case A"]

    listed_all = await client.get(
        "/api/ai-feedback", params={"discovery_id": "d-3", "surface": "usecase"}
    )
    assert sorted(r["feedback"] for r in listed_all.json()) == ["case A", "case B"]


async def test_delete_feedback(client: AsyncClient) -> None:
    created = await client.post(
        "/api/ai-feedback",
        json={"discovery_id": "d-4", "surface": "grounded", "feedback": "wrong company"},
    )
    feedback_id = created.json()["id"]

    deleted = await client.delete(f"/api/ai-feedback/{feedback_id}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    listed = await client.get(
        "/api/ai-feedback", params={"discovery_id": "d-4", "surface": "grounded"}
    )
    assert listed.json() == []


async def test_delete_404_when_missing(client: AsyncClient) -> None:
    resp = await client.delete("/api/ai-feedback/nope")
    assert resp.status_code == 404


async def test_create_rejects_empty_feedback(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/ai-feedback",
        json={"discovery_id": "d-5", "surface": "problem", "feedback": ""},
    )
    # Pydantic min_length=1 → 422.
    assert resp.status_code == 422


async def test_create_rejects_unknown_surface(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/ai-feedback",
        json={"discovery_id": "d-6", "surface": "totally-fake", "feedback": "nope"},
    )
    assert resp.status_code == 422
