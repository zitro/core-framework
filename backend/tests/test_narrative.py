"""Tests for the Discovery Narrative router."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_narrative_generate_validation_rejects_empty_id(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/narrative/generate", json={"discovery_id": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_narrative_generate_returns_structured_payload(app):
    fake_llm_response = {
        "headline": "We are ready to align on next steps.",
        "summary": "We have heard the team and identified a path forward.",
        "sections": [
            {"title": "Where We Are", "body": "Capture is complete."},
            {"title": "Recommended Next Steps", "body": "Run a pilot."},
            {"title": "", "body": "should be filtered"},  # filtered out
        ],
    }
    fake_llm = AsyncMock()
    fake_llm.complete_json = AsyncMock(return_value=fake_llm_response)

    with (
        patch("app.routers.narrative.get_llm_provider", return_value=fake_llm),
        patch("app.routers.narrative.gather_context", AsyncMock(return_value="ctx")),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/narrative/generate",
                json={"discovery_id": "abc", "audience": "executive", "style": "narrative"},
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["headline"].startswith("We are ready")
    assert body["audience"] == "executive"
    assert len(body["sections"]) == 2  # empty title filtered


@pytest.mark.asyncio
async def test_narrative_generate_502_when_llm_fails(app):
    fake_llm = AsyncMock()
    fake_llm.complete_json = AsyncMock(side_effect=RuntimeError("boom"))

    with (
        patch("app.routers.narrative.get_llm_provider", return_value=fake_llm),
        patch("app.routers.narrative.gather_context", AsyncMock(return_value="ctx")),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/narrative/generate",
                json={"discovery_id": "abc"},
            )
    assert resp.status_code == 502
