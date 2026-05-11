"""Phase 6F router tests: /connectors marketplace + /notes CRUD."""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider
from app.synthesis.connectors import list_connectors

pytestmark = pytest.mark.asyncio


async def _seed_project(project_id: str) -> None:
    storage = get_storage_provider()
    await storage.create(
        "engagements",
        {
            "id": project_id,
            "name": "Test",
            "customer": "Acme",
            "status": "proposed",
            "owners": [],
        },
    )


# ── /connectors marketplace ────────────────────────────────────────────


async def test_get_connectors_returns_marketplace_catalog(client: AsyncClient) -> None:
    resp = await client.get("/api/synthesis/connectors")
    assert resp.status_code == 200
    body = resp.json()
    assert "connectors" in body
    assert len(body["connectors"]) == len(list_connectors())
    # Every connector entry should at least carry kind + label.
    for c in body["connectors"]:
        assert "kind" in c
        assert "label" in c


async def test_update_project_connectors_writes_metadata(client: AsyncClient) -> None:
    await _seed_project("proj-connectors")
    payload: dict[str, Any] = {
        "sources": {
            "github": {"repos": ["acme/handbook"], "token": "ghp_test"},
            "web": {"urls": ["https://acme.example.com/about"]},
        }
    }
    resp = await client.put("/api/synthesis/proj-connectors/connectors", json=payload)
    assert resp.status_code == 200
    assert resp.json()["sources"] == payload["sources"]

    # Verify it persisted: reload the engagement record from storage.
    storage = get_storage_provider()
    reloaded = await storage.get("engagements", "proj-connectors")
    assert reloaded["metadata"]["sources"] == payload["sources"]


async def test_update_project_connectors_404_when_project_missing(
    client: AsyncClient,
) -> None:
    resp = await client.put(
        "/api/synthesis/missing/connectors",
        json={"sources": {}},
    )
    assert resp.status_code == 404


# ── /notes CRUD ────────────────────────────────────────────────────────


async def test_add_note_persists_and_returns_record(client: AsyncClient) -> None:
    await _seed_project("proj-notes-add")
    resp = await client.post(
        "/api/synthesis/proj-notes-add/notes",
        json={
            "text": "Sarah said onboarding takes 6 weeks.",
            "target_type_id": "problem-statement",
        },
    )
    assert resp.status_code == 200
    note = resp.json()["note"]
    assert note["id"].startswith("note_")
    assert note["text"].startswith("Sarah said")
    assert note["target_type_id"] == "problem-statement"
    assert note["project_id"] == "proj-notes-add"


async def test_add_note_rejects_too_short_text(client: AsyncClient) -> None:
    await _seed_project("proj-notes-short")
    resp = await client.post(
        "/api/synthesis/proj-notes-short/notes",
        json={"text": "x"},
    )
    assert resp.status_code == 422


async def test_list_notes_returns_newest_first(client: AsyncClient) -> None:
    """The sort key is created_at desc. We tolerate same-millisecond
    creates (back-to-back POSTs can land within one tick on the test
    storage) — what matters is that BOTH notes come back."""
    import asyncio

    await _seed_project("proj-notes-list")
    await client.post(
        "/api/synthesis/proj-notes-list/notes",
        json={"text": "first note about intake"},
    )
    # Ensure created_at moves forward by at least one millisecond.
    await asyncio.sleep(0.005)
    await client.post(
        "/api/synthesis/proj-notes-list/notes",
        json={"text": "second note about triage"},
    )

    resp = await client.get("/api/synthesis/proj-notes-list/notes")
    assert resp.status_code == 200
    items = resp.json()["notes"]
    assert len(items) == 2
    # Sorted desc — second insert wins
    assert items[0]["text"] == "second note about triage"
    assert items[1]["text"] == "first note about intake"


async def test_list_notes_excludes_other_projects(client: AsyncClient) -> None:
    await _seed_project("proj-notes-A")
    await _seed_project("proj-notes-B")
    await client.post("/api/synthesis/proj-notes-A/notes", json={"text": "note A"})
    await client.post("/api/synthesis/proj-notes-B/notes", json={"text": "note B"})

    resp_a = await client.get("/api/synthesis/proj-notes-A/notes")
    a_items = resp_a.json()["notes"]
    assert len(a_items) == 1
    assert a_items[0]["text"] == "note A"


async def test_delete_note_round_trip(client: AsyncClient) -> None:
    await _seed_project("proj-notes-del")
    add = await client.post("/api/synthesis/proj-notes-del/notes", json={"text": "to delete"})
    note_id = add.json()["note"]["id"]

    delete = await client.delete(f"/api/synthesis/proj-notes-del/notes/{note_id}")
    assert delete.status_code == 200
    assert delete.json() == {"deleted": True}

    listing = await client.get("/api/synthesis/proj-notes-del/notes")
    assert listing.json() == {"notes": []}


async def test_delete_note_404_when_missing(client: AsyncClient) -> None:
    await _seed_project("proj-notes-del-missing")
    resp = await client.delete("/api/synthesis/proj-notes-del-missing/notes/note_unknown")
    assert resp.status_code == 404
