"""Tests for /api/health/schema."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.schemas import incompatibility
from app.schemas.incompatibility import IncompatibilityRecord, record_incompatibility


@pytest.fixture(autouse=True)
def _clear_registry():
    incompatibility.clear()
    yield
    incompatibility.clear()


@pytest.mark.asyncio
async def test_schema_health_reports_known_kinds(client: AsyncClient):
    res = await client.get("/api/health/schema")
    assert res.status_code == 200
    body = res.json()
    assert "core_discovery_marker" in body["known_kinds"]
    assert any(k["kind"] == "core_discovery_marker" for k in body["kinds"])


@pytest.mark.asyncio
async def test_schema_health_reports_supported_versions(client: AsyncClient):
    res = await client.get("/api/health/schema")
    body = res.json()
    marker = next(k for k in body["kinds"] if k["kind"] == "core_discovery_marker")
    assert marker["supported_versions"] == ["1.0.0"]


@pytest.mark.asyncio
async def test_schema_health_surfaces_incompatibilities(client: AsyncClient):
    record_incompatibility(
        IncompatibilityRecord(
            kind="core_discovery_marker",
            path="/data/seed/customers/bad.json",
            file_version="0.9.0",
            supported_version="1.0.0",
            reason="migration: no chain from 0.9.0",
        )
    )
    res = await client.get("/api/health/schema")
    body = res.json()
    assert "core_discovery_marker" in body["incompatibilities"]
    records = body["incompatibilities"]["core_discovery_marker"]
    assert len(records) == 1
    assert records[0]["path"] == "/data/seed/customers/bad.json"
    assert records[0]["file_version"] == "0.9.0"


@pytest.mark.asyncio
async def test_schema_health_empty_incompatibilities_by_default(client: AsyncClient):
    res = await client.get("/api/health/schema")
    assert res.json()["incompatibilities"] == {}
