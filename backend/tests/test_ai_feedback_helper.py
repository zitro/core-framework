"""Tests for app/utils/ai_feedback.render_feedback_block."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.utils.ai_feedback import render_feedback_block

pytestmark = pytest.mark.asyncio


async def test_renders_empty_when_no_feedback(client: AsyncClient) -> None:
    """No persisted feedback → empty string (no prompt block)."""
    assert await render_feedback_block("nope", "problem") == ""


async def test_renders_block_when_feedback_exists(client: AsyncClient) -> None:
    """One or more feedback entries → 'User feedback to apply:' block."""
    for text in ("Too generic.", "Anchor on claims cycle time."):
        resp = await client.post(
            "/api/ai-feedback",
            json={"discovery_id": "d-1", "surface": "problem", "feedback": text},
        )
        assert resp.status_code == 200

    block = await render_feedback_block("d-1", "problem")
    assert block.startswith("User feedback to apply")
    assert "Too generic." in block
    assert "Anchor on claims cycle time." in block


async def test_scopes_by_surface(client: AsyncClient) -> None:
    """Feedback on `usecase` does not leak into `problem`."""
    await client.post(
        "/api/ai-feedback",
        json={"discovery_id": "d-2", "surface": "usecase", "feedback": "usecase-only"},
    )
    assert "usecase-only" not in await render_feedback_block("d-2", "problem")
    assert "usecase-only" in await render_feedback_block("d-2", "usecase")


async def test_scopes_by_item_key(client: AsyncClient) -> None:
    """When item_key is given, only matching entries render."""
    for key, text in (("a", "for A"), ("b", "for B")):
        await client.post(
            "/api/ai-feedback",
            json={
                "discovery_id": "d-3",
                "surface": "narrative",
                "item_key": key,
                "feedback": text,
            },
        )

    only_a = await render_feedback_block("d-3", "narrative", item_key="a")
    assert "for A" in only_a
    assert "for B" not in only_a


async def test_returns_empty_when_inputs_missing() -> None:
    """Defensive — missing discovery_id or surface → empty."""
    assert await render_feedback_block("", "problem") == ""
    assert await render_feedback_block("d", "") == ""
