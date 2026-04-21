"""Microsoft Graph provider abstraction (read-only M365 surfaces)."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class GraphFile:
    id: str
    name: str
    web_url: str = ""
    last_modified: str = ""
    size: int = 0
    snippet: str = ""


@dataclass
class GraphMessage:
    id: str
    subject: str
    sender: str = ""
    received: str = ""
    web_url: str = ""
    snippet: str = ""


@dataclass
class GraphMeeting:
    id: str
    subject: str
    organizer: str = ""
    start: str = ""
    end: str = ""
    join_url: str = ""
    snippet: str = ""


class GraphProvider(ABC):
    """Read-only Microsoft Graph access for files, messages, and meetings."""

    @property
    def enabled(self) -> bool:
        return True

    @abstractmethod
    async def search_files(self, query: str, *, limit: int = 10) -> list[GraphFile]: ...

    @abstractmethod
    async def search_messages(self, query: str, *, limit: int = 10) -> list[GraphMessage]: ...

    @abstractmethod
    async def list_meetings(self, *, days: int = 7, limit: int = 20) -> list[GraphMeeting]: ...
