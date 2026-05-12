"""Phase 6K router + adapter tests for engagement-repo write-back."""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import AsyncClient

from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


async def _seed_project(project_id: str, *, repo_path: str, meta: dict | None = None) -> None:
    storage = get_storage_provider()
    await storage.create(
        "engagements",
        {
            "id": project_id,
            "name": "Test",
            "customer": "Acme",
            "status": "proposed",
            "owners": [],
            "repo_path": repo_path,
            "metadata": meta or {},
        },
    )


async def _seed_artifact(
    project_id: str,
    artifact_id: str,
    *,
    type_id: str = "problem-statement",
    category: str = "why",
    title: str = "Claims pain",
) -> None:
    storage = get_storage_provider()
    await storage.create(
        "artifacts",
        {
            "id": artifact_id,
            "project_id": project_id,
            "type_id": type_id,
            "category": category,
            "title": title,
            "summary": "Agents juggle tools.",
            "body": {"statement": "Agents juggle three tools."},
            "citations": [{"source_id": "engagement-repo:intake.md", "quote": "see intake"}],
            "status": "draft",
            "version": 1,
        },
    )


# ── opt-in gate ────────────────────────────────────────────────────────


async def test_writeback_noop_when_disabled(client: AsyncClient, tmp_path: Path) -> None:
    await _seed_project("proj-wb-off", repo_path=str(tmp_path))
    await _seed_artifact("proj-wb-off", "art-1")
    resp = await client.post("/api/synthesis/proj-wb-off/writeback/engagement-repo")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is False
    assert body["written"] == []
    # Confirm no synthesis/ dir was created on disk.
    assert not (tmp_path / "synthesis").exists()


# ── full project push ──────────────────────────────────────────────────


async def test_writeback_writes_markdown_for_each_artifact(
    client: AsyncClient, tmp_path: Path
) -> None:
    await _seed_project(
        "proj-wb-on",
        repo_path=str(tmp_path),
        meta={"engagement-repo": {"write_enabled": True}},
    )
    await _seed_artifact("proj-wb-on", "art-a", title="A")
    await _seed_artifact(
        "proj-wb-on",
        "art-b",
        type_id="value-prop",
        category="what",
        title="B",
    )
    resp = await client.post("/api/synthesis/proj-wb-on/writeback/engagement-repo")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is True
    assert any(p.endswith("synthesis/why/problem-statement.md") for p in body["written"])
    assert any(p.endswith("synthesis/what/value-prop.md") for p in body["written"])
    assert any(p.endswith("synthesis/_index.md") for p in body["written"])

    # Spot-check that the file was actually written + contains the title.
    md = (tmp_path / "synthesis" / "why" / "problem-statement.md").read_text()
    assert "# A" in md
    index_md = (tmp_path / "synthesis" / "_index.md").read_text()
    assert "Synthesis — Test" in index_md
    assert "problem-statement" in index_md


async def test_writeback_returns_errors_when_repo_missing(
    client: AsyncClient, tmp_path: Path
) -> None:
    missing = tmp_path / "no-such-dir"
    await _seed_project(
        "proj-wb-missing",
        repo_path=str(missing),
        meta={"engagement-repo": {"write_enabled": True}},
    )
    await _seed_artifact("proj-wb-missing", "art-x")
    resp = await client.post("/api/synthesis/proj-wb-missing/writeback/engagement-repo")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is True
    assert any("repo not found" in e for e in body["errors"])


# ── single-artifact push ───────────────────────────────────────────────


async def test_push_single_artifact(client: AsyncClient, tmp_path: Path) -> None:
    await _seed_project(
        "proj-push",
        repo_path=str(tmp_path),
        meta={"engagement-repo": {"write_enabled": True}},
    )
    await _seed_artifact("proj-push", "art-one")
    await _seed_artifact(
        "proj-push", "art-two", type_id="value-prop", category="what", title="Other"
    )
    resp = await client.post("/api/synthesis/proj-push/artifacts/art-one/push")
    assert resp.status_code == 200
    body = resp.json()
    # Only art-one's file should be written (plus the index).
    assert any(p.endswith("synthesis/why/problem-statement.md") for p in body["written"])
    assert not any(p.endswith("synthesis/what/value-prop.md") for p in body["written"])


async def test_push_404_when_artifact_missing(client: AsyncClient, tmp_path: Path) -> None:
    await _seed_project(
        "proj-push-404",
        repo_path=str(tmp_path),
        meta={"engagement-repo": {"write_enabled": True}},
    )
    resp = await client.post("/api/synthesis/proj-push-404/artifacts/nope/push")
    assert resp.status_code == 404


# ── settings ───────────────────────────────────────────────────────────


async def test_update_settings_persists_write_enabled(client: AsyncClient, tmp_path: Path) -> None:
    await _seed_project("proj-set", repo_path=str(tmp_path))
    resp = await client.put(
        "/api/synthesis/proj-set/settings/engagement-repo",
        json={"write_enabled": True, "write_subdir": "synth-out"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["engagement-repo"]["write_enabled"] is True
    assert body["engagement-repo"]["write_subdir"] == "synth-out"

    # And: a subsequent writeback honours the new subdir.
    await _seed_artifact("proj-set", "art-s")
    push = await client.post("/api/synthesis/proj-set/writeback/engagement-repo")
    assert push.status_code == 200
    assert any("synth-out/" in p for p in push.json()["written"])


async def test_update_settings_strips_slashes(client: AsyncClient, tmp_path: Path) -> None:
    await _seed_project("proj-clean", repo_path=str(tmp_path))
    resp = await client.put(
        "/api/synthesis/proj-clean/settings/engagement-repo",
        json={"write_enabled": True, "write_subdir": "//weird/path/"},
    )
    assert resp.status_code == 200
    assert resp.json()["engagement-repo"]["write_subdir"] == "weird/path"
