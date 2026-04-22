"""Project model tests — slug derivation, by-slug lookup, projects alias."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_engagement_create_auto_derives_slug(client: AsyncClient) -> None:
    res = await client.post("/api/engagements/", json={"name": "Allstate Claims Modernization"})
    assert res.status_code in (200, 201), res.text
    eng = res.json()
    assert eng["slug"] == "allstate-claims-modernization"


@pytest.mark.asyncio
async def test_engagement_slug_uniqueness(client: AsyncClient) -> None:
    a = (await client.post("/api/engagements/", json={"name": "Pilot"})).json()
    b = (await client.post("/api/engagements/", json={"name": "Pilot"})).json()
    c = (await client.post("/api/engagements/", json={"name": "Pilot"})).json()
    assert a["slug"] == "pilot"
    assert b["slug"] == "pilot-2"
    assert c["slug"] == "pilot-3"


@pytest.mark.asyncio
async def test_engagement_lookup_by_slug(client: AsyncClient) -> None:
    created = (await client.post("/api/engagements/", json={"name": "FNOL Pilot"})).json()
    res = await client.get(f"/api/engagements/by-slug/{created['slug']}")
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


@pytest.mark.asyncio
async def test_engagement_lookup_by_slug_missing(client: AsyncClient) -> None:
    res = await client.get("/api/engagements/by-slug/does-not-exist")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_projects_alias_lists_engagements(client: AsyncClient) -> None:
    created = (await client.post("/api/engagements/", json={"name": "Aliased"})).json()
    res = await client.get("/api/projects/")
    assert res.status_code == 200
    ids = [p["id"] for p in res.json()]
    assert created["id"] in ids


@pytest.mark.asyncio
async def test_projects_alias_create_round_trips(client: AsyncClient) -> None:
    res = await client.post("/api/projects/", json={"name": "Via Projects API"})
    assert res.status_code in (200, 201), res.text
    item = res.json()
    assert item["slug"] == "via-projects-api"
    # Reachable from both prefixes
    via_eng = await client.get(f"/api/engagements/{item['id']}")
    assert via_eng.status_code == 200


@pytest.mark.asyncio
async def test_engagement_patch_slug_normalizes(client: AsyncClient) -> None:
    eng = (await client.post("/api/engagements/", json={"name": "X"})).json()
    res = await client.patch(f"/api/engagements/{eng['id']}", json={"slug": "Hello World!!"})
    assert res.status_code == 200
    assert res.json()["slug"] == "hello-world"
