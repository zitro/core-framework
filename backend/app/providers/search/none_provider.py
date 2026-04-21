"""No-op search provider — returns empty results.

Used when no search engine is configured. Keeps callers branch-free: they can
always call `provider.search(...)` without checking `enabled`, but should still
respect the empty list semantically.
"""

from app.providers.search.base import SearchProvider, SearchResult


class NoneSearchProvider(SearchProvider):
    """Returns no results. The default provider when nothing is configured."""

    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        return []

    @property
    def enabled(self) -> bool:
        return False
