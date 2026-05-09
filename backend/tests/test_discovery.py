"""Tests for the discovery router — CRUD operations."""

import pytest
from httpx import AsyncClient

from app.providers.search.base import SearchResult


@pytest.mark.asyncio
async def test_create_discovery(client: AsyncClient):
    resp = await client.post(
        "/api/discovery/",
        json={"name": "Test Discovery", "description": "Unit test"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Discovery"
    assert data["current_phase"] == "capture"
    assert data["id"]


@pytest.mark.asyncio
async def test_list_discoveries_empty(client: AsyncClient):
    resp = await client.get("/api/discovery/")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_discoveries_returns_created(client: AsyncClient):
    await client.post("/api/discovery/", json={"name": "D1"})
    await client.post("/api/discovery/", json={"name": "D2"})
    resp = await client.get("/api/discovery/")
    assert resp.status_code == 200
    names = {d["name"] for d in resp.json()}
    assert names == {"D1", "D2"}


@pytest.mark.asyncio
async def test_get_discovery(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "Fetch Me"})
    did = create.json()["id"]
    resp = await client.get(f"/api/discovery/{did}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Fetch Me"


@pytest.mark.asyncio
async def test_get_discovery_not_found(client: AsyncClient):
    resp = await client.get("/api/discovery/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_discovery(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "Original"})
    did = create.json()["id"]
    resp = await client.patch(
        f"/api/discovery/{did}", json={"name": "Updated", "current_phase": "orchestrate"}
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"
    assert resp.json()["current_phase"] == "orchestrate"


@pytest.mark.asyncio
async def test_update_discovery_enriches_new_technology_targets(client: AsyncClient, monkeypatch):
    from app.utils import technology_enrichment

    class FakeSearchProvider:
        enabled = True

        async def search(self, query: str, *, limit: int = 5):
            return [
                SearchResult(
                    title="Vector databases overview",
                    url="https://example.com/vector-db",
                    snippet="Vector databases are used for semantic search and retrieval.",
                    source="test",
                )
            ]

    class FakeLlmProvider:
        async def complete(self, system_prompt: str, user_prompt: str, **kwargs):
            assert "Vector DB" in user_prompt
            return """## What It Is
Source-backed overview.

## What People Use It For
- Semantic retrieval.

## What People Are Saying
- Useful for RAG workloads.

## Pros
- Fast similarity search.

## Cons / Watchouts
- Requires indexing and evaluation.

## Related Technologies And Alternatives
- Search indexes and graph stores.

## Sources
- [Vector databases overview](https://example.com/vector-db)"""

    monkeypatch.setattr(technology_enrichment, "get_search_provider", lambda: FakeSearchProvider())
    monkeypatch.setattr(technology_enrichment, "get_llm_provider", lambda: FakeLlmProvider())

    create = await client.post("/api/discovery/", json={"name": "Tech Discovery"})
    did = create.json()["id"]

    resp = await client.patch(
        f"/api/discovery/{did}",
        json={
            "target_technologies": [{"name": "Vector DB", "focus": "semantic retrieval"}],
            "solution_providers": ["Vector DB"],
        },
    )

    assert resp.status_code == 200
    evidence = await client.get(f"/api/evidence/{did}?phase=orchestrate")
    assert evidence.status_code == 200
    items = evidence.json()
    assert len(items) == 1
    assert items[0]["source"] == "Technology research: Vector DB"
    assert items[0]["evidence_type"] == "insight"
    assert "technology-research" in items[0]["tags"]
    assert "## Pros" in items[0]["content"]
    assert "## Cons / Watchouts" in items[0]["content"]


@pytest.mark.asyncio
async def test_update_discovery_does_not_duplicate_existing_technology_research(
    client: AsyncClient,
    monkeypatch,
):
    from app.utils import technology_enrichment

    calls = 0

    class FakeSearchProvider:
        enabled = True

        async def search(self, query: str, *, limit: int = 5):
            return [
                SearchResult(
                    title="Queue systems overview",
                    url="https://example.com/queues",
                    snippet="Queue systems help decouple services.",
                    source="test",
                )
            ]

    class FakeLlmProvider:
        async def complete(self, system_prompt: str, user_prompt: str, **kwargs):
            nonlocal calls
            calls += 1
            return (
                "## What It Is\nResearch\n\n"
                "## Pros\n- Durable messaging\n\n"
                "## Cons / Watchouts\n- Operational overhead"
            )

    monkeypatch.setattr(technology_enrichment, "get_search_provider", lambda: FakeSearchProvider())
    monkeypatch.setattr(technology_enrichment, "get_llm_provider", lambda: FakeLlmProvider())

    create = await client.post("/api/discovery/", json={"name": "Tech Discovery"})
    did = create.json()["id"]
    payload = {
        "target_technologies": [{"name": "Message Queue", "focus": "workflow events"}],
        "solution_providers": ["Message Queue"],
    }

    first = await client.patch(f"/api/discovery/{did}", json=payload)
    second = await client.patch(f"/api/discovery/{did}", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    evidence = await client.get(f"/api/evidence/{did}?phase=orchestrate")
    assert evidence.status_code == 200
    assert len(evidence.json()) == 1
    assert calls == 1


@pytest.mark.asyncio
async def test_update_discovery_empty_body(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "NoOp"})
    did = create.json()["id"]
    resp = await client.patch(f"/api/discovery/{did}", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_delete_discovery(client: AsyncClient):
    create = await client.post("/api/discovery/", json={"name": "Delete Me"})
    did = create.json()["id"]
    resp = await client.delete(f"/api/discovery/{did}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    # Verify gone
    resp = await client.get(f"/api/discovery/{did}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_discovery_not_found(client: AsyncClient):
    resp = await client.delete("/api/discovery/nonexistent")
    assert resp.status_code == 404
