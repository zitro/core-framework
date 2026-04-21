"""DuckDuckGo Instant Answer + HTML scrape — free, no API key required.

This is the default web search engine when SEARCH_PROVIDER=web is set. It uses
the public Instant Answer JSON endpoint plus the HTML results page (no scraping
JavaScript). Suitable for low-volume discovery research.
"""

from __future__ import annotations

import logging
import re
from html import unescape
from urllib.parse import unquote

import httpx

from app.providers.search.base import SearchProvider, SearchResult

logger = logging.getLogger(__name__)

_INSTANT_URL = "https://api.duckduckgo.com/"
_HTML_URL = "https://html.duckduckgo.com/html/"
_USER_AGENT = "core-discovery/0.2 (+https://github.com/zitro/core-framework)"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
_RESULT_RE = re.compile(
    r'<a[^>]*class="result__a"[^>]*href="(?P<url>[^"]+)"[^>]*>(?P<title>.*?)</a>'
    r'.*?<a[^>]*class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
    re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(s: str) -> str:
    return unescape(_TAG_RE.sub("", s)).strip()


def _normalize_url(href: str) -> str:
    """DuckDuckGo redirects results through /l/?uddg=<encoded>; unwrap it."""
    if href.startswith("//"):
        href = "https:" + href
    if "uddg=" in href:
        try:
            return unquote(href.split("uddg=", 1)[1].split("&", 1)[0])
        except IndexError:
            return href
    return href


class DuckDuckGoSearchProvider(SearchProvider):
    """Free public DuckDuckGo search. Best-effort, no auth, may rate-limit."""

    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        if not query.strip():
            return []

        results: list[SearchResult] = []
        async with httpx.AsyncClient(
            timeout=_TIMEOUT, headers={"User-Agent": _USER_AGENT}, follow_redirects=True
        ) as client:
            # 1) Instant Answer for definition-style queries
            try:
                ia = await client.get(
                    _INSTANT_URL,
                    params={"q": query, "format": "json", "no_redirect": "1", "no_html": "1"},
                )
                if ia.status_code == 200:
                    data = ia.json()
                    if data.get("AbstractText") and data.get("AbstractURL"):
                        results.append(
                            SearchResult(
                                title=data.get("Heading") or query,
                                url=data["AbstractURL"],
                                snippet=data["AbstractText"],
                                source="duckduckgo",
                            )
                        )
            except (httpx.HTTPError, ValueError):
                logger.debug("DuckDuckGo instant answer failed", exc_info=True)

            # 2) HTML results page for organic results
            try:
                html = await client.post(_HTML_URL, data={"q": query})
                if html.status_code == 200:
                    for match in _RESULT_RE.finditer(html.text):
                        if len(results) >= limit:
                            break
                        results.append(
                            SearchResult(
                                title=_strip_html(match["title"]),
                                url=_normalize_url(match["url"]),
                                snippet=_strip_html(match["snippet"]),
                                source="duckduckgo",
                            )
                        )
            except httpx.HTTPError:
                logger.warning("DuckDuckGo HTML search failed", exc_info=True)

        # Deduplicate by URL preserving order
        seen: set[str] = set()
        deduped: list[SearchResult] = []
        for r in results:
            if r.url in seen:
                continue
            seen.add(r.url)
            deduped.append(r)
        return deduped[:limit]
