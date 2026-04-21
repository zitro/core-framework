"""Tests for /api/dt-templates."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_list_templates(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dt-templates")
    assert resp.status_code == 200
    ids = {t["id"] for t in resp.json()}
    assert {"empathy-map", "persona", "journey-map", "hmw-board", "assumption-matrix"} <= ids


@pytest.mark.asyncio
async def test_get_template_returns_markdown(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dt-templates/empathy-map")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "empathy-map"
    assert "# Empathy Map" in body["content"]


@pytest.mark.asyncio
async def test_get_unknown_template_returns_404(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dt-templates/nope")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_drop_template_into_repo(app, tmp_path):
    # Build a minimal engagement repo: root with a content sub-dir holding a markdown file.
    content = tmp_path / "engagement"
    (content / "topic-a").mkdir(parents=True)
    (content / "topic-a" / "seed.md").write_text("---\ntitle: Seed\n---\n", encoding="utf-8")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dt-templates/persona/drop",
            json={"repo_path": str(tmp_path), "name_suffix": "Field Tech"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["path"].endswith(".md")
    assert "design-thinking" in body["path"]
