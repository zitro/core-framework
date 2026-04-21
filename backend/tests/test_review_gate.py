"""Review gate helpers in isolation."""

import pytest

from app.providers.storage import get_storage_provider
from app.utils.review_gate import (
    auto_request_review,
    is_blocked_by_review,
    latest_status,
)


@pytest.mark.asyncio
async def test_auto_request_review_is_idempotent(app) -> None:  # noqa: ARG001
    storage = get_storage_provider()
    await auto_request_review(
        artifact_collection="problem_statements",
        artifact_id="x1",
        artifact_title="t",
        discovery_id="d",
    )
    await auto_request_review(
        artifact_collection="problem_statements",
        artifact_id="x1",
        artifact_title="t",
        discovery_id="d",
    )
    rows = await storage.list("reviews", {"artifact_id": "x1"})
    assert len(rows) == 1
    assert await is_blocked_by_review("problem_statements", "x1")
    assert await latest_status("problem_statements", "x1") == "pending"
