"""Search provider factory.

Selection via `SEARCH_PROVIDER` env var:

- `none` (default) — no results, search is disabled.
- `web` or `duckduckgo` — free DuckDuckGo, no key required.
- `bing` — Bing Web Search v7, requires `BING_SEARCH_API_KEY`.
"""

from functools import lru_cache

from app.config import settings
from app.providers.search.base import SearchProvider, SearchResult

__all__ = ["SearchProvider", "SearchResult", "get_search_provider"]


@lru_cache(maxsize=1)
def get_search_provider() -> SearchProvider:
    """Return the configured search provider (cached singleton)."""
    match settings.search_provider:
        case "bing":
            from app.providers.search.bing import BingSearchProvider

            return BingSearchProvider()
        case "web" | "duckduckgo":
            from app.providers.search.duckduckgo import DuckDuckGoSearchProvider

            return DuckDuckGoSearchProvider()
        case "none" | "":
            from app.providers.search.none_provider import NoneSearchProvider

            return NoneSearchProvider()
        case _:
            raise ValueError(f"Unknown SEARCH_PROVIDER: {settings.search_provider}")
