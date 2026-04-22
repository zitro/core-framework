"""Project context middleware + per-project list scoping (local provider).

Validates that the X-Project-Id header propagates through middleware into the
storage layer's list-scoping behavior, with `engagements` and `audit` exempt.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_no_header_returns_all_data(client: AsyncClient) -> None:
    """Without X-Project-Id, list returns everything (legacy behavior)."""
    a = (await client.post("/api/discovery/", json={"name": "A"})).json()
    b = (await client.post("/api/discovery/", json={"name": "B"})).json()
    res = await client.get("/api/discovery/")
    assert res.status_code == 200
    ids = {d["id"] for d in res.json()}
    assert {a["id"], b["id"]} <= ids


@pytest.mark.asyncio
async def test_engagements_listing_ignores_project_header(
    client: AsyncClient,
) -> None:
    """Engagements collection is not project-partitioned; header is ignored."""
    eng = (await client.post("/api/engagements/", json={"name": "Anywhere"})).json()
    res = await client.get("/api/engagements/", headers={"X-Project-Id": "some-other-project"})
    assert res.status_code == 200
    assert any(e["id"] == eng["id"] for e in res.json())
