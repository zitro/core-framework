"""Tests for the agent registry and the generic /api/agents router."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


def test_registry_contains_all_dt_agents():
    from app.agents import agent_registry

    ids = set(agent_registry().keys())
    expected = {
        "discovery-coach",
        "problem-analyst",
        "use-case-analyst",
        "solution-architect",
        "transcript-analyst",
        "empathy-researcher",
        "hmw-framer",
        "ideation-facilitator",
        "assumption-tester",
    }
    missing = expected - ids
    assert not missing, f"Missing agents in registry: {missing}"


@pytest.mark.asyncio
async def test_list_agents_endpoint(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/agents")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    ids = {a["agent_id"] for a in body}
    assert "empathy-researcher" in ids
    assert "hmw-framer" in ids
    assert "ideation-facilitator" in ids
    assert "assumption-tester" in ids


@pytest.mark.asyncio
async def test_run_unknown_agent_returns_404(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/agents/does-not-exist/run",
            json={"discovery_id": "abc"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_run_dt_agent_persists_result(app):
    """Smoke-test the dt_helpers run loop end-to-end via the HMW Framer."""
    fake_llm = AsyncMock()
    fake_llm.complete_json = AsyncMock(
        return_value={
            "questions": [
                {
                    "hmw": "How might we reduce onboarding friction?",
                    "persona": "new analyst",
                    "underlying_pain": "first-week setup is fragmented",
                    "rationale": "shifts focus from tooling to outcomes",
                    "scope": "narrow",
                }
            ]
        }
    )

    with (
        patch("app.agents.dt_helpers.BaseAgent._llm", staticmethod(lambda: fake_llm)),
        patch(
            "app.agents.base.gather_context",
            AsyncMock(return_value="some context"),
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/agents/hmw-framer/run",
                json={"discovery_id": "test-disc", "user_instructions": "focus on onboarding"},
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["agent_id"] == "hmw-framer"
    assert body["data"]["result"]["questions"][0]["scope"] == "narrow"
