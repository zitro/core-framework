"""Audit log writes and read endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_audit_records_engagement_lifecycle(client: AsyncClient) -> None:
    eng = (
        await client.post("/api/engagements/", json={"name": "Audit Test", "customer": "Z"})
    ).json()
    await client.patch(f"/api/engagements/{eng['id']}", json={"name": "Audit Test 2"})
    await client.delete(f"/api/engagements/{eng['id']}")

    res = await client.get(f"/api/audit/?collection=engagements&item_id={eng['id']}")
    assert res.status_code == 200, res.text
    actions = [r["action"] for r in res.json()]
    assert "create" in actions
    assert "update" in actions
    assert "delete" in actions


@pytest.mark.asyncio
async def test_audit_filters(client: AsyncClient) -> None:
    res = await client.get("/api/audit/?limit=10")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
