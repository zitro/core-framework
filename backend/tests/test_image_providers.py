"""Image provider unit tests â€” no network, deterministic."""

from __future__ import annotations

import pytest

from app.providers.image.local_svg import LocalSVGImageProvider, _palette_for, _wrap
from app.providers.image.noop import NoopImageProvider


@pytest.mark.asyncio
async def test_noop_returns_empty_url():
    img = await NoopImageProvider().generate("any prompt")
    assert img.url == ""
    assert img.alt_text == "any prompt"
    assert img.provider == "none"


@pytest.mark.asyncio
async def test_local_svg_returns_data_uri():
    img = await LocalSVGImageProvider().generate("a calm office at dawn")
    assert img.provider == "local"
    assert img.url.startswith("data:image/svg+xml;base64,")
    assert img.alt_text == "a calm office at dawn"


@pytest.mark.asyncio
async def test_local_svg_is_deterministic():
    a = await LocalSVGImageProvider().generate("repeat me")
    b = await LocalSVGImageProvider().generate("repeat me")
    assert a.url == b.url


@pytest.mark.asyncio
async def test_local_svg_handles_empty_prompt():
    img = await LocalSVGImageProvider().generate("")
    assert img.url.startswith("data:image/svg+xml;base64,")


@pytest.mark.asyncio
async def test_local_svg_invalid_size_falls_back():
    img = await LocalSVGImageProvider().generate("hi", size="garbage")
    assert img.url.startswith("data:image/svg+xml;base64,")


def test_palette_is_stable_per_prompt():
    assert _palette_for("foo") == _palette_for("foo")


def test_wrap_caps_lines():
    long = " ".join(["word"] * 200)
    assert len(_wrap(long)) <= 6
