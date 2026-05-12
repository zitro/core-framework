"""Phase 6L tests for image providers + POST /api/v2/.../images."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.providers.image import GeneratedImage, ImageProvider, get_image_provider
from app.providers.image.local_svg import LocalSVGImageProvider
from app.providers.image.noop import NoopImageProvider
from app.providers.storage import get_storage_provider

pytestmark = pytest.mark.asyncio


# ── provider factory ───────────────────────────────────────────────────


async def test_provider_factory_defaults_to_local(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "image_provider", "local")
    get_image_provider.cache_clear()
    assert isinstance(get_image_provider(), LocalSVGImageProvider)


async def test_provider_factory_noop_when_none(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "image_provider", "none")
    get_image_provider.cache_clear()
    assert isinstance(get_image_provider(), NoopImageProvider)


async def test_provider_factory_unknown_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "image_provider", "totally-fake")
    get_image_provider.cache_clear()
    with pytest.raises(ValueError):
        get_image_provider()


# ── local SVG provider ─────────────────────────────────────────────────


async def test_local_svg_provider_returns_data_uri() -> None:
    provider = LocalSVGImageProvider()
    image = await provider.generate("an analyst clicking through dashboards")
    assert image.provider == "local"
    assert image.url.startswith("data:image/svg+xml;base64,")
    assert image.alt_text == "an analyst clicking through dashboards"


async def test_local_svg_provider_is_deterministic() -> None:
    """Same prompt yields the same data URI — important so storyboards
    re-render identically after a UI reload."""
    provider = LocalSVGImageProvider()
    a = await provider.generate("frame one")
    b = await provider.generate("frame one")
    assert a.url == b.url


async def test_noop_provider_returns_empty_url() -> None:
    provider = NoopImageProvider()
    image = await provider.generate("anything")
    assert image.url == ""
    assert image.provider == "none"


# ── /api/v2/.../images endpoint ────────────────────────────────────────


async def _seed(
    project_id: str, artifact_id: str, body: dict, *, type_id: str = "storyboard"
) -> None:
    storage = get_storage_provider()
    await storage.create(
        "engagements",
        {"id": project_id, "name": "T", "customer": "A", "status": "proposed", "owners": []},
    )
    await storage.create(
        "artifacts",
        {
            "id": artifact_id,
            "project_id": project_id,
            "type_id": type_id,
            "category": "what",
            "title": "Storyboard",
            "summary": "",
            "body": body,
            "citations": [],
            "status": "draft",
            "version": 1,
        },
    )


async def test_generate_fills_missing_frames(client: AsyncClient) -> None:
    body = {
        "persona": "Claims agent",
        "frames": [
            {"caption": "Receives ticket", "image_prompt": "an agent at a desk"},
            {"caption": "Searches policy", "image_url": "https://existing/img.png"},
            {"caption": "Replies to customer", "description": "drafts a response"},
        ],
        "takeaway": "Three steps today",
    }
    await _seed("proj-sb", "art-sb", body)
    resp = await client.post("/api/v2/proj-sb/artifacts/art-sb/images")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["provider"] == "local"
    assert payload["generated"] == 2
    assert payload["skipped"] == 1
    frames = payload["artifact"]["body"]["frames"]
    assert frames[0]["image_url"].startswith("data:image/svg+xml;base64,")
    assert frames[1]["image_url"] == "https://existing/img.png"  # preserved
    assert frames[2]["image_url"].startswith("data:image/svg+xml;base64,")


async def test_generate_is_idempotent_on_second_call(client: AsyncClient) -> None:
    body = {"frames": [{"caption": "A", "image_prompt": "the start"}]}
    await _seed("proj-idem", "art-idem", body)
    first = await client.post("/api/v2/proj-idem/artifacts/art-idem/images")
    second = await client.post("/api/v2/proj-idem/artifacts/art-idem/images")
    assert first.status_code == second.status_code == 200
    # Second call should skip every frame (all already have URLs).
    assert second.json()["generated"] == 0
    assert second.json()["skipped"] == 1


async def test_generate_422_for_non_storyboard(client: AsyncClient) -> None:
    await _seed("proj-nope", "art-nope", {"statement": "x"}, type_id="problem-statement")
    resp = await client.post("/api/v2/proj-nope/artifacts/art-nope/images")
    assert resp.status_code == 422


async def test_generate_422_when_no_frames(client: AsyncClient) -> None:
    await _seed("proj-empty", "art-empty", {"frames": []})
    resp = await client.post("/api/v2/proj-empty/artifacts/art-empty/images")
    assert resp.status_code == 422


async def test_generate_404_when_artifact_missing(client: AsyncClient) -> None:
    resp = await client.post("/api/v2/proj-x/artifacts/missing/images")
    assert resp.status_code == 404


async def test_generate_502_when_provider_raises(client: AsyncClient) -> None:
    body = {"frames": [{"caption": "boom", "image_prompt": "anything"}]}
    await _seed("proj-boom", "art-boom", body)

    class _BrokenProvider(ImageProvider):
        name = "broken"

        async def generate(self, prompt: str, *, size: str = "1024x1024") -> GeneratedImage:
            raise RuntimeError("upstream down")

    with patch("app.routers.v2.get_image_provider", return_value=_BrokenProvider()):
        resp = await client.post("/api/v2/proj-boom/artifacts/art-boom/images")
    assert resp.status_code == 502
