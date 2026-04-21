from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SearchResult:
    """Single search result returned by a provider."""

    title: str
    url: str
    snippet: str
    source: str = ""  # provider/engine identifier (e.g. "duckduckgo", "bing")


class SearchProvider(ABC):
    """Abstract base for web/internal search providers.

    Implementations must be safe to instantiate without network access; any
    network calls happen in `search()` so factories can be cached without
    blocking startup.
    """

    @abstractmethod
    async def search(self, query: str, *, limit: int = 5) -> list[SearchResult]:
        """Run a search and return up to `limit` results."""

    @property
    def enabled(self) -> bool:
        """Whether the provider is configured to actually return results."""
        return True
