"""Bing Web Search v7 — requires `BING_SEARCH_API_KEY`.

Use when you need higher volume / quality than DuckDuckGo. Set
`SEARCH_PROVIDER=bing` and `BING_SEARCH_API_KEY=<key>`.
"""

from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.providers.search.base import SearchProvider, SearchResult

logger = logging.getLogger(__name__)

_DEFAULT_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class BingSearchProvider(SearchProvider):
    """Bing Web Search v7 client."""

    def __init__(self) -> None:
        self._api_key = settings.bing_search_api_key
        self._endpoint = settings.bing_search_endpoint or _DEFAULT_ENDPOINT

    @property
    def enabled(self) -> bool:
        return bool(self._api_key)

    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        if not self.enabled or not query.strip():
            return []
        headers = {"Ocp-Apim-Subscription-Key": self._api_key}
        params = {"q": query, "count": min(max(limit, 1), 20), "responseFilter": "Webpages"}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(self._endpoint, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError:
            logger.warning("Bing search failed", exc_info=True)
            return []

        items = (data.get("webPages") or {}).get("value") or []
        return [
            SearchResult(
                title=item.get("name", ""),
                url=item.get("url", ""),
                snippet=item.get("snippet", ""),
                source="bing",
            )
            for item in items[:limit]
        ]
