"""v2 endpoint tests: storyboard image generation + vertex tree viewer."""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.providers.image import get_image_provider


@pytest.fixture(autouse=True)
def _local_image_provider():
    """Default image provider in tests is local SVG so endpoints are usable."""
    from app.config import settings

    prev_env = os.environ.get("IMAGE_PROVIDER")
    prev_settings = settings.image_provider
    os.environ["IMAGE_PROVIDER"] = "local"
    settings.image_provider = "local"
    get_image_provider.cache_clear()
    yield
    settings.image_provider = prev_settings
    if prev_env is None:
        os.environ.pop("IMAGE_PROVIDER", None)
    else:
        os.environ["IMAGE_PROVIDER"] = prev_env
    get_image_provider.cache_clear()


async def _seed_storyboard(client: AsyncClient, repo_root: Path | None = None) -> tuple[str, str]:
    """Create a project + a storyboard artifact directly in storage. Returns
    ``(project_id, artifact_id)``."""
    from app.providers.storage import get_storage_provider
    from app.synthesis.generator import ARTIFACTS_COLLECTION

    project_payload = {"name": "Story project", "customer": "Acme"}
    if repo_root is not None:
        project_payload["repo_path"] = str(repo_root)
    project = (await client.post("/api/engagements/", json=project_payload)).json()
    project_id = project["id"]

    storage = get_storage_provider()
    artifact_id = str(uuid4())
    await storage.create(
        ARTIFACTS_COLLECTION,
        {
            "id": artifact_id,
            "project_id": project_id,
            "type_id": "storyboard",
            "category": "story",
            "title": "Day in the life",
            "summary": "",
            "body": {
                "persona": "Field rep",
                "frames": [
                    {
                        "caption": "Morning",
                        "description": "Rep starts the day",
                        "image_prompt": "field rep with tablet at sunrise",
                    },
                    {
                        "caption": "Site",
                        "description": "Rep at customer site",
                        "image_prompt": "rep on factory floor",
                        "image_url": "https://existing.example/img.png",
                    },
                ],
                "takeaway": "Faster days",
            },
            "citations": [],
            "status": "draft",
            "version": 1,
            "model": "test",
        },
    )
    return project_id, artifact_id


@pytest.mark.asyncio
async def test_generate_storyboard_images_fills_missing(client: AsyncClient):
    project_id, artifact_id = await _seed_storyboard(client)
    res = await client.post(f"/api/v2/{project_id}/artifacts/{artifact_id}/images")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["provider"] == "local"
    assert body["generated"] == 1  # only the first frame had no url
    assert body["skipped"] == 1
    frames = body["artifact"]["body"]["frames"]
    assert frames[0]["image_url"].startswith("data:image/svg+xml")
    assert frames[1]["image_url"] == "https://existing.example/img.png"


@pytest.mark.asyncio
async def test_generate_images_rejects_non_storyboard(client: AsyncClient):
    from app.providers.storage import get_storage_provider
    from app.synthesis.generator import ARTIFACTS_COLLECTION

    project = (await client.post("/api/engagements/", json={"name": "X", "customer": "Y"})).json()
    artifact_id = str(uuid4())
    await get_storage_provider().create(
        ARTIFACTS_COLLECTION,
        {
            "id": artifact_id,
            "project_id": project["id"],
            "type_id": "persona",
            "category": "why",
            "title": "P",
            "body": {},
            "citations": [],
            "status": "draft",
            "version": 1,
        },
    )
    res = await client.post(f"/api/v2/{project['id']}/artifacts/{artifact_id}/images")
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_generate_images_404_when_artifact_missing(client: AsyncClient):
    project = (await client.post("/api/engagements/", json={"name": "X", "customer": "Y"})).json()
    res = await client.post(f"/api/v2/{project['id']}/artifacts/missing/images")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_vertex_tree_unavailable_when_no_repo(client: AsyncClient):
    project = (await client.post("/api/engagements/", json={"name": "X", "customer": "Y"})).json()
    res = await client.get(f"/api/v2/{project['id']}/vertex/tree")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is False
    assert body["root"] is None


@pytest.mark.asyncio
async def test_vertex_tree_lists_markdown(client: AsyncClient, tmp_path: Path):
    (tmp_path / "vertex.json").write_text('{"name":"acme"}', encoding="utf-8")
    (tmp_path / "customer-details.md").write_text("# Acme\n", encoding="utf-8")
    nested = tmp_path / "initiative" / "transcripts"
    nested.mkdir(parents=True)
    (nested / "kickoff.md").write_text("# Kickoff", encoding="utf-8")
    (tmp_path / "ignored.bin").write_bytes(b"\x00\x01")

    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.get(f"/api/v2/{project_id}/vertex/tree")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True
    names = {c["name"] for c in body["root"]["children"]}
    assert "vertex.json" in names
    assert "customer-details.md" in names
    assert "initiative" in names
    assert "ignored.bin" not in names


@pytest.mark.asyncio
async def test_vertex_file_returns_content(client: AsyncClient, tmp_path: Path):
    (tmp_path / "notes.md").write_text("# Hello\nworld", encoding="utf-8")
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.get(f"/api/v2/{project_id}/vertex/file", params={"path": "notes.md"})
    assert res.status_code == 200
    assert res.json()["content"].startswith("# Hello")


@pytest.mark.asyncio
async def test_vertex_file_rejects_traversal(client: AsyncClient, tmp_path: Path):
    (tmp_path / "ok.md").write_text("ok", encoding="utf-8")
    project_id, _ = await _seed_storyboard(client, repo_root=tmp_path)
    res = await client.get(f"/api/v2/{project_id}/vertex/file", params={"path": "../../etc/passwd"})
    assert res.status_code == 404
