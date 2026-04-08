"""Tests for question generation and solution matching."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_generate_questions(client: AsyncClient, mock_llm: AsyncMock):
    # Create a discovery first (storage needs it for saving question sets)
    await client.post("/api/discovery/", json={"name": "Q Test"})

    with patch("app.routers.questions.get_llm_provider", return_value=mock_llm):
        resp = await client.post(
            "/api/questions/generate",
            json={
                "discovery_id": "test-123",
                "phase": "capture",
                "context": "Financial reporting system",
                "num_questions": 3,
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["questions"]) == 1  # mock returns 1
    assert data["phase"] == "capture"
    assert data["discovery_id"] == "test-123"
    mock_llm.complete_json.assert_called_once()


@pytest.mark.asyncio
async def test_generate_questions_llm_failure(client: AsyncClient, mock_llm: AsyncMock):
    mock_llm.complete_json.side_effect = RuntimeError("LLM offline")

    with patch("app.routers.questions.get_llm_provider", return_value=mock_llm):
        resp = await client.post(
            "/api/questions/generate",
            json={"discovery_id": "test-123", "phase": "capture"},
        )

    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_solution_match(client: AsyncClient, mock_llm: AsyncMock):
    mock_llm.complete_json.return_value = {
        "matches": [
            {
                "problem": "Slow reporting",
                "capabilities": ["Power BI"],
                "gap": "Real-time data",
                "confidence": 75,
            }
        ]
    }

    with patch("app.routers.questions.get_llm_provider", return_value=mock_llm):
        resp = await client.post(
            "/api/questions/solution-match",
            json={
                "discovery_id": "test-123",
                "problem": "Slow reporting",
                "capabilities": ["Power BI", "Azure SQL"],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["matches"]) == 1
    assert data["matches"][0]["confidence"] == 75
