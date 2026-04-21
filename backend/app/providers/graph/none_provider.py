"""Disabled Graph provider used when GRAPH_PROVIDER=none."""

from app.providers.graph.base import (
    GraphFile,
    GraphMeeting,
    GraphMessage,
    GraphProvider,
)


class NoneGraphProvider(GraphProvider):
    @property
    def enabled(self) -> bool:
        return False

    async def search_files(self, query: str, *, limit: int = 10) -> list[GraphFile]:
        return []

    async def search_messages(self, query: str, *, limit: int = 10) -> list[GraphMessage]:
        return []

    async def list_meetings(self, *, days: int = 7, limit: int = 20) -> list[GraphMeeting]:
        return []
