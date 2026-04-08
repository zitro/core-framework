"""Tests for the evidence router — CRUD and filtering."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_evidence(client: AsyncClient):
    resp = await client.post(
        "/api/evidence/",
        json={
            "discovery_id": "disc-1",
            "phase": "capture",
            "content": "User mentioned pain with reporting",
            "source": "interview",
            "confidence": "assumed",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "User mentioned pain with reporting"
    assert data["phase"] == "capture"


@pytest.mark.asyncio
async def test_list_evidence_by_discovery(client: AsyncClient):
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "Evidence A"},
    )
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "orient", "content": "Evidence B"},
    )
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d2", "phase": "capture", "content": "Other"},
    )

    resp = await client.get("/api/evidence/d1")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2


@pytest.mark.asyncio
async def test_list_evidence_with_phase_filter(client: AsyncClient):
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "A"},
    )
    await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "orient", "content": "B"},
    )

    resp = await client.get("/api/evidence/d1?phase=capture")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["phase"] == "capture"


@pytest.mark.asyncio
async def test_update_evidence(client: AsyncClient):
    create = await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "Original"},
    )
    eid = create.json()["id"]
    resp = await client.patch(f"/api/evidence/{eid}", json={"content": "Revised"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "Revised"


@pytest.mark.asyncio
async def test_delete_evidence(client: AsyncClient):
    create = await client.post(
        "/api/evidence/",
        json={"discovery_id": "d1", "phase": "capture", "content": "Temp"},
    )
    eid = create.json()["id"]
    resp = await client.delete(f"/api/evidence/{eid}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
