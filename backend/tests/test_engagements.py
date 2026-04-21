"""Engagement CRUD and discovery scoping."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_engagement_create_list_and_filter(client: AsyncClient) -> None:
    payload = {"name": "Acme Modernization", "customer": "Acme"}
    res = await client.post("/api/engagements/", json=payload)
    assert res.status_code in (200, 201), res.text
    eng = res.json()
    eng_id = eng["id"]

    res = await client.get("/api/engagements/")
    assert res.status_code == 200
    assert any(e["id"] == eng_id for e in res.json())

    disc_payload = {"name": "Quote AI", "description": "Acme quoting"}
    disc_res = await client.post("/api/discovery/", json=disc_payload)
    assert disc_res.status_code in (200, 201), disc_res.text
    disc = disc_res.json()

    res = await client.post(f"/api/engagements/{eng_id}/discoveries/{disc['id']}")
    assert res.status_code in (200, 204)

    scoped = await client.get(f"/api/discovery/?engagement_id={eng_id}")
    assert scoped.status_code == 200
    ids = [d["id"] for d in scoped.json()]
    assert disc["id"] in ids


@pytest.mark.asyncio
async def test_engagement_update_and_delete(client: AsyncClient) -> None:
    eng = (await client.post("/api/engagements/", json={"name": "X", "customer": "Y"})).json()
    res = await client.patch(f"/api/engagements/{eng['id']}", json={"name": "X2"})
    assert res.status_code == 200 and res.json()["name"] == "X2"

    res = await client.delete(f"/api/engagements/{eng['id']}")
    assert res.status_code == 200 and res.json()["deleted"] is True
