"""Tests for health, config validation, and auth middleware."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "providers" in data
    assert data["providers"]["llm"] == "local"
    assert data["providers"]["auth"] == "none"


@pytest.mark.asyncio
async def test_config_defaults():
    from app.config import Settings

    s = Settings(
        llm_provider="local",
        storage_provider="local",
        auth_provider="none",
    )
    assert s.app_name == "CORE Discovery API"
    assert s.debug is False
    assert s.ollama_base_url == "http://localhost:11434"


@pytest.mark.asyncio
async def test_cors_headers(client: AsyncClient):
    resp = await client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    # CORS preflight should not return 405
    assert resp.status_code in (200, 204)
