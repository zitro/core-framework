"""Unit tests for the v1.9.0 enterprise connectors.

Each connector is exercised end-to-end against an ``httpx.MockTransport``
so we never touch the network. We assert:
  * happy path produces the expected number of ``SourceDoc``s
  * empty / missing config returns an empty list
  * the registry advertises every shipped connector kind
"""

from __future__ import annotations

import base64
import json

import httpx
import pytest

from app.synthesis.connectors import list_connectors
from app.synthesis.models import SourceKind
from app.synthesis.sources.github import GitHubSourceAdapter
from app.synthesis.sources.http_json import HttpJsonSourceAdapter
from app.synthesis.sources.web import WebSourceAdapter

# ─── registry ────────────────────────────────────────────────────────────────


def test_registry_lists_all_kinds():
    kinds = {c["kind"] for c in list_connectors()}
    expected = {
        SourceKind.VERTEX.value,
        SourceKind.LOCAL_DIR.value,
        SourceKind.MS_GRAPH_FILE.value,
        SourceKind.GITHUB.value,
        SourceKind.WEB.value,
        SourceKind.HTTP_JSON.value,
    }
    assert expected.issubset(kinds)


def test_registry_entries_have_schema():
    for entry in list_connectors():
        assert "config_schema" in entry
        assert entry["config_schema"]["type"] == "object"


# ─── github ──────────────────────────────────────────────────────────────────


def _gh_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/git/trees/master"):
        return httpx.Response(
            200,
            json={
                "tree": [
                    {"type": "blob", "path": "README.md", "sha": "abc"},
                    {"type": "blob", "path": "docs/x.md", "sha": "def"},
                    {"type": "blob", "path": "src/code.py", "sha": "ignore"},
                ]
            },
        )
    if "/git/blobs/" in request.url.path:
        sha = request.url.path.rsplit("/", 1)[-1]
        return httpx.Response(
            200,
            json={
                "encoding": "base64",
                "content": base64.b64encode(f"# content {sha}".encode()).decode(),
            },
        )
    return httpx.Response(404)


@pytest.mark.asyncio
async def test_github_adapter_happy_path():
    transport = httpx.MockTransport(_gh_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        adapter = GitHubSourceAdapter(client=client)
        docs = await adapter.fetch(
            {
                "metadata": {
                    "sources": {
                        "github": {
                            "repos": [{"owner": "z", "repo": "r"}],
                        }
                    }
                }
            }
        )
    assert len(docs) == 2
    assert all(d.kind == SourceKind.GITHUB for d in docs)
    assert docs[0].id.startswith("github:z/r@master:")
    assert "content" in docs[0].text


@pytest.mark.asyncio
async def test_github_adapter_no_config_returns_empty():
    adapter = GitHubSourceAdapter()
    assert await adapter.fetch({"metadata": {}}) == []


# ─── web ────────────────────────────────────────────────────────────────────


def _web_handler(request: httpx.Request) -> httpx.Response:
    if request.url.host == "ok.example":
        return httpx.Response(
            200,
            text="<html><head><title>Hi</title></head><body><p>hello world</p></body></html>",
            headers={"content-type": "text/html"},
        )
    if request.url.host == "txt.example":
        return httpx.Response(200, text="plain body", headers={"content-type": "text/plain"})
    return httpx.Response(500)


@pytest.mark.asyncio
async def test_web_adapter_strips_html_and_keeps_plaintext():
    transport = httpx.MockTransport(_web_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        adapter = WebSourceAdapter(client=client)
        docs = await adapter.fetch(
            {
                "metadata": {
                    "sources": {
                        "web": {
                            "urls": [
                                "https://ok.example/a",
                                {"url": "https://txt.example/b", "title": "B"},
                            ]
                        }
                    }
                }
            }
        )
    assert len(docs) == 2
    html_doc = next(d for d in docs if "ok.example" in d.uri)
    assert html_doc.title == "Hi"
    assert "hello world" in html_doc.text
    assert "<p>" not in html_doc.text
    txt_doc = next(d for d in docs if "txt.example" in d.uri)
    assert txt_doc.title == "B"
    assert txt_doc.text == "plain body"


@pytest.mark.asyncio
async def test_web_adapter_no_config_returns_empty():
    adapter = WebSourceAdapter()
    assert await adapter.fetch({"metadata": {}}) == []


# ─── http_json ──────────────────────────────────────────────────────────────


def _json_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "issues": [
                {"key": "P-1", "summary": "first", "description": "body 1"},
                {"key": "P-2", "summary": "second", "description": "body 2"},
            ]
        },
    )


@pytest.mark.asyncio
async def test_http_json_adapter_maps_records():
    transport = httpx.MockTransport(_json_handler)
    async with httpx.AsyncClient(transport=transport) as client:
        adapter = HttpJsonSourceAdapter(client=client)
        docs = await adapter.fetch(
            {
                "metadata": {
                    "sources": {
                        "http_json": {
                            "endpoints": [
                                {
                                    "url": "https://api.example/issues",
                                    "items_path": "issues",
                                    "id_field": "key",
                                    "title_field": "summary",
                                    "text_field": "description",
                                }
                            ]
                        }
                    }
                }
            }
        )
    assert [d.title for d in docs] == ["first", "second"]
    assert docs[0].id == "http:https://api.example/issues#P-1"
    assert docs[0].text == "body 1"


@pytest.mark.asyncio
async def test_http_json_adapter_no_config_returns_empty():
    adapter = HttpJsonSourceAdapter()
    assert await adapter.fetch({"metadata": {}}) == []


@pytest.mark.asyncio
async def test_http_json_adapter_falls_back_to_full_row():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[{"id": "x", "blob": {"a": 1}}])

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        adapter = HttpJsonSourceAdapter(client=client)
        docs = await adapter.fetch(
            {
                "metadata": {
                    "sources": {
                        "http_json": {
                            "endpoints": [
                                {
                                    "url": "https://api.example/x",
                                }
                            ]
                        }
                    }
                }
            }
        )
    assert len(docs) == 1
    assert json.loads(docs[0].text) == {"id": "x", "blob": {"a": 1}}
