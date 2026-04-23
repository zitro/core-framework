"""Tests for v2.1 vertex ingest endpoints (extract / classify / write)."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from tests.test_v2_endpoints import _seed_storyboard


@pytest.mark.asyncio
async def test_vertex_extract_paste_file(client: AsyncClient, tmp_path: Path):
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.post(
        f"/api/v2/{project_id}/vertex/extract",
        files={"file": ("notes.md", b"# hello\nworld", "text/markdown")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["source"] == "file"
    assert "hello" in body["text"]
    assert body["filename"] == "notes.md"


@pytest.mark.asyncio
async def test_vertex_extract_requires_input(client: AsyncClient, tmp_path: Path):
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.post(f"/api/v2/{project_id}/vertex/extract", data={})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_vertex_classify_routes_to_proposed_folder(client: AsyncClient, tmp_path: Path):
    (tmp_path / "discovery").mkdir()
    (tmp_path / "evidence").mkdir()
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)

    fake_llm = AsyncMock()
    fake_llm.complete_json = AsyncMock(
        return_value={
            "dest_path": "discovery",
            "filename": "persona-fieldrep.md",
            "rationale": "Persona profile for a field rep",
            "confidence": 0.85,
        }
    )
    with patch("app.routers.v2_vertex_ingest.get_llm_provider", return_value=fake_llm):
        res = await client.post(
            f"/api/v2/{project_id}/vertex/classify",
            json={"content": "Persona: field rep, age 35..."},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["dest_path"] == "discovery"
    assert body["filename"] == "persona-fieldrep.md"
    assert body["confidence"] >= 0.4
    assert "discovery" in body["sections_considered"]


@pytest.mark.asyncio
async def test_vertex_classify_falls_back_to_inbox_on_low_confidence(
    client: AsyncClient, tmp_path: Path
):
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    fake_llm = AsyncMock()
    fake_llm.complete_json = AsyncMock(
        return_value={
            "dest_path": "discovery",
            "filename": "weak.md",
            "rationale": "Not sure",
            "confidence": 0.1,
        }
    )
    with patch("app.routers.v2_vertex_ingest.get_llm_provider", return_value=fake_llm):
        res = await client.post(
            f"/api/v2/{project_id}/vertex/classify",
            json={"content": "Some unrelated text"},
        )
    assert res.status_code == 200
    assert res.json()["dest_path"] == "inbox"


@pytest.mark.asyncio
async def test_vertex_classify_handles_llm_error(client: AsyncClient, tmp_path: Path):
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    fake_llm = AsyncMock()
    fake_llm.complete_json = AsyncMock(side_effect=RuntimeError("offline"))
    with patch("app.routers.v2_vertex_ingest.get_llm_provider", return_value=fake_llm):
        res = await client.post(
            f"/api/v2/{project_id}/vertex/classify",
            json={"content": "anything"},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["dest_path"] == "inbox"
    assert body["confidence"] == 0.0


@pytest.mark.asyncio
async def test_vertex_write_creates_file_and_audit_log(client: AsyncClient, tmp_path: Path):
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.post(
        f"/api/v2/{project_id}/vertex/write",
        json={
            "path": "inbox/hello.md",
            "content": "# Hi\n",
            "source": "paste",
            "classifier_confidence": 0.9,
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["created"] is True
    assert (tmp_path / "inbox" / "hello.md").read_text() == "# Hi\n"
    log = (tmp_path / ".vertex-log.jsonl").read_text().strip().splitlines()
    assert len(log) == 1
    rec = json.loads(log[0])
    assert rec["path"] == "inbox/hello.md"
    assert rec["source"] == "paste"


@pytest.mark.asyncio
async def test_vertex_write_rejects_overwrite_without_flag(client: AsyncClient, tmp_path: Path):
    (tmp_path / "exists.md").write_text("old", encoding="utf-8")
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.post(
        f"/api/v2/{project_id}/vertex/write",
        json={"path": "exists.md", "content": "new"},
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_vertex_write_blocks_traversal(client: AsyncClient, tmp_path: Path):
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.post(
        f"/api/v2/{project_id}/vertex/write",
        json={"path": "../escape.md", "content": "x"},
    )
    assert res.status_code == 400
