"""Tests for the search provider abstraction and /api/search endpoint."""

import pytest

from app.providers.search import get_search_provider
from app.providers.search.base import SearchResult
from app.providers.search.duckduckgo import _normalize_url, _strip_html
from app.providers.search.none_provider import NoneSearchProvider


@pytest.mark.asyncio
async def test_none_provider_returns_empty_and_disabled():
    p = NoneSearchProvider()
    assert p.enabled is False
    assert await p.search("anything") == []


def test_factory_returns_none_by_default(monkeypatch):
    monkeypatch.setenv("SEARCH_PROVIDER", "none")
    from app.config import settings

    settings.search_provider = "none"
    get_search_provider.cache_clear()
    assert isinstance(get_search_provider(), NoneSearchProvider)


def test_factory_unknown_raises(monkeypatch):
    from app.config import settings

    settings.search_provider = "made-up"
    get_search_provider.cache_clear()
    with pytest.raises(ValueError):
        get_search_provider()
    settings.search_provider = "none"
    get_search_provider.cache_clear()


def test_strip_html_removes_tags_and_unescapes():
    assert _strip_html("<b>Hello&nbsp;world</b>") == "Hello\xa0world"
    assert _strip_html("<a>foo</a> <i>bar</i>") == "foo bar"


def test_normalize_url_unwraps_duckduckgo_redirect():
    raw = "//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&rut=abc"
    assert _normalize_url(raw) == "https://example.com/page"
    assert _normalize_url("//example.com/x") == "https://example.com/x"
    assert _normalize_url("https://example.com/x") == "https://example.com/x"


def test_search_result_dataclass_fields():
    r = SearchResult(title="t", url="u", snippet="s", source="x")
    assert r.title == "t"
    assert r.url == "u"
    assert r.snippet == "s"
    assert r.source == "x"


@pytest.mark.asyncio
async def test_search_endpoint_returns_disabled_when_none(app):
    from httpx import ASGITransport, AsyncClient

    from app.config import settings

    settings.search_provider = "none"
    get_search_provider.cache_clear()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/search", json={"query": "anything"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["enabled"] is False
    assert body["results"] == []
