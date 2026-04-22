"""HTTP JSON source adapter.

Fetches JSON endpoints and turns each top-level record into a
`SourceDoc`. Useful for Jira/ADO/Confluence-style read APIs without
writing a per-system connector.

Per-project config under ``project.metadata.sources.http_json``:

    {
        "endpoints": [
            {
                "url": "https://api.example.com/issues",
                "headers": {"Authorization": "Bearer ..."},
                "items_path": "issues",            # JSONPath-lite (dot only)
                "id_field": "key",
                "title_field": "summary",
                "text_field": "description",
                "uri_field": "url",
                "max_items": 100
            }
        ]
    }

We intentionally keep the path syntax simple — dot-separated keys — so
config stays readable. JSONPath, jmespath, etc. are explicit non-goals.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.synthesis.models import SourceDoc, SourceKind
from app.synthesis.sources.base import SourceAdapter

logger = logging.getLogger(__name__)

_DEFAULT_MAX_ITEMS = 100
_MAX_TEXT_CHARS = 32 * 1024


class HttpJsonSourceAdapter(SourceAdapter):
    kind = SourceKind.HTTP_JSON.value

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    async def fetch(self, project: dict) -> list[SourceDoc]:
        cfg = ((project.get("metadata") or {}).get("sources") or {}).get("http_json") or {}
        endpoints = cfg.get("endpoints") or []
        if not endpoints:
            return []

        own = self._client is None
        client = self._client or httpx.AsyncClient(timeout=20.0, follow_redirects=True)
        try:
            docs: list[SourceDoc] = []
            for ep in endpoints:
                try:
                    docs.extend(await self._fetch_endpoint(client, ep))
                except Exception:
                    logger.exception("http_json adapter: %s failed", ep)
            return docs
        finally:
            if own:
                await client.aclose()

    async def _fetch_endpoint(
        self,
        client: httpx.AsyncClient,
        ep: dict,
    ) -> list[SourceDoc]:
        url = (ep.get("url") or "").strip()
        if not url:
            return []
        headers = dict(ep.get("headers") or {})
        r = await client.get(url, headers=headers)
        if r.status_code != 200:
            logger.warning("http_json fetch %s -> %s", url, r.status_code)
            return []

        try:
            payload = r.json()
        except json.JSONDecodeError:
            logger.warning("http_json fetch %s returned non-JSON", url)
            return []

        items = _walk(payload, ep.get("items_path") or "")
        if not isinstance(items, list):
            items = [items]
        items = items[: int(ep.get("max_items") or _DEFAULT_MAX_ITEMS)]

        id_field = ep.get("id_field") or "id"
        title_field = ep.get("title_field") or "title"
        text_field = ep.get("text_field") or "text"
        uri_field = ep.get("uri_field") or ""

        docs: list[SourceDoc] = []
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            raw_id = _walk(item, id_field) or f"row-{i}"
            text = _walk(item, text_field)
            if text is None:
                # fall back to the whole row so callers still get evidence
                text = json.dumps(item, ensure_ascii=False)
            if not isinstance(text, str):
                text = json.dumps(text, ensure_ascii=False)
            text = text[:_MAX_TEXT_CHARS]
            title = _walk(item, title_field) or str(raw_id)
            uri = _walk(item, uri_field) or url if uri_field else url
            docs.append(
                SourceDoc(
                    id=f"http:{url}#{raw_id}",
                    kind=SourceKind.HTTP_JSON,
                    title=str(title),
                    uri=str(uri) if uri else url,
                    snippet=text[:300],
                    text=text,
                    metadata={"endpoint": url},
                )
            )
        return docs


def _walk(data: Any, path: str) -> Any:
    """Resolve a dot-separated path. Empty path returns ``data`` as-is."""
    if not path:
        return data
    cur: Any = data
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        elif isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
        if cur is None:
            return None
    return cur
