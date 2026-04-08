"""Tests for the export router — JSON and CSV downloads."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_export_json(client: AsyncClient):
    # Create a discovery and evidence
    create = await client.post("/api/discovery/", json={"name": "Export Test"})
    did = create.json()["id"]
    await client.post(
        "/api/evidence/",
        json={"discovery_id": did, "phase": "capture", "content": "Finding 1"},
    )

    resp = await client.get(f"/api/export/{did}?format=json")
    assert resp.status_code == 200
    assert "application/json" in resp.headers["content-type"]
    data = resp.json()
    assert data["discovery"]["name"] == "Export Test"
    assert len(data["evidence"]) == 1


@pytest.mark.asyncio
async def test_export_csv(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "CSV Export"})
    did = create.json()["id"]
    await client.post(
        "/api/evidence/",
        json={"discovery_id": did, "phase": "orient", "content": "Finding CSV"},
    )

    resp = await client.get(f"/api/export/{did}?format=csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    text = resp.text
    assert "CSV Export" in text
    assert "Finding CSV" in text


@pytest.mark.asyncio
async def test_export_not_found(client: AsyncClient):
    resp = await client.get("/api/export/nonexistent?format=json")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_export_invalid_format(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "Bad Format"})
    did = create.json()["id"]
    resp = await client.get(f"/api/export/{did}?format=pdf")
    assert resp.status_code == 422
