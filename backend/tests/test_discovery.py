"""Tests for the discovery router — CRUD operations."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_discovery(client: AsyncClient):
    resp = await client.post(
        "/api/discovery/",
        json={"name": "Test Discovery", "description": "Unit test"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Discovery"
    assert data["current_phase"] == "capture"
    assert data["id"]


@pytest.mark.asyncio
async def test_list_discoveries_empty(client: AsyncClient):
    resp = await client.get("/api/discovery/")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_discoveries_returns_created(client: AsyncClient):
    await client.post("/api/discovery/", json={"name": "D1"})
    await client.post("/api/discovery/", json={"name": "D2"})
    resp = await client.get("/api/discovery/")
    assert resp.status_code == 200
    names = {d["name"] for d in resp.json()}
    assert names == {"D1", "D2"}


@pytest.mark.asyncio
async def test_get_discovery(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "Fetch Me"})
    did = create.json()["id"]
    resp = await client.get(f"/api/discovery/{did}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Fetch Me"


@pytest.mark.asyncio
async def test_get_discovery_not_found(client: AsyncClient):
    resp = await client.get("/api/discovery/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_discovery(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "Original"})
    did = create.json()["id"]
    resp = await client.patch(
        f"/api/discovery/{did}", json={"name": "Updated", "current_phase": "orient"}
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"
    assert resp.json()["current_phase"] == "orient"


@pytest.mark.asyncio
async def test_update_discovery_empty_body(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "NoOp"})
    did = create.json()["id"]
    resp = await client.patch(f"/api/discovery/{did}", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_discovery(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "Delete Me"})
    did = create.json()["id"]
    resp = await client.delete(f"/api/discovery/{did}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    # Verify gone
    resp = await client.get(f"/api/discovery/{did}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_discovery_not_found(client: AsyncClient):
    resp = await client.delete("/api/discovery/nonexistent")
    assert resp.status_code == 404
