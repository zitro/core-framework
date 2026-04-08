"""Tests for transcript analysis."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_analyze_transcript(client: AsyncClient, mock_llm: AsyncMock):
    mock_llm.complete_json.return_value = {
        "insights": [
            {
                "text": "Team struggles with compliance reporting",
                "confidence": "validated",
                "phase": "capture",
            }
        ],
        "evidence": [
            {
                "content": "Manual reports take 3 hours daily",
                "confidence": "validated",
                "phase": "capture",
                "tags": ["reporting", "manual"],
            }
        ],
        "sentiment": "negative",
        "key_themes": ["compliance", "manual-process"],
    }

    with patch("app.routers.transcripts.get_llm_provider", return_value=mock_llm):
        resp = await client.post(
            "/api/transcripts/analyze",
            json={
                "discovery_id": "test-disc",
                "transcript_text": "The reporting process is really painful...",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["insights"]) == 1
    assert len(data["evidence_extracted"]) == 1
    assert data["sentiment"] == "negative"
    assert "compliance" in data["key_themes"]


@pytest.mark.asyncio
async def test_analyze_transcript_llm_failure(client: AsyncClient, mock_llm: AsyncMock):
    mock_llm.complete_json.side_effect = RuntimeError("LLM offline")

    with patch("app.routers.transcripts.get_llm_provider", return_value=mock_llm):
        resp = await client.post(
            "/api/transcripts/analyze",
            json={
                "discovery_id": "test-disc",
                "transcript_text": "Some transcript text",
            },
        )

    assert resp.status_code == 502
