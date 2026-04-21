"""Review request + decision flow."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_review_create_and_decide(client: AsyncClient) -> None:
    payload = {
        "artifact_collection": "problem_statements",
        "artifact_id": "abc123",
        "artifact_title": "Pricing latency",
        "discovery_id": "d1",
    }
    res = await client.post("/api/reviews/", json=payload)
    assert res.status_code in (200, 201), res.text
    review = res.json()
    rid = review["id"]
    assert review["status"] == "pending"

    res = await client.post(
        f"/api/reviews/{rid}/decision",
        json={"status": "approved", "notes": "ok"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_reviews_filter_by_engagement(client: AsyncClient) -> None:
    res = await client.get("/api/reviews/")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
