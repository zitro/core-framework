"""Dynamics 365 / Dataverse provider abstraction (read-only)."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CrmAccount:
    id: str
    name: str
    industry: str = ""
    revenue: str = ""
    website: str = ""
    primary_contact: str = ""
    snippet: str = ""


class DynamicsProvider(ABC):
    @property
    def enabled(self) -> bool:
        return True

    @abstractmethod
    async def search_accounts(self, query: str, *, limit: int = 10) -> list[CrmAccount]:
        ...

    @abstractmethod
    async def get_account(self, account_id: str) -> CrmAccount | None:
        ...
