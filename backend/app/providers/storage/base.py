from abc import ABC, abstractmethod
from typing import Any


class StorageProvider(ABC):
    """Abstract base for data storage. Swap Azure Cosmos DB, SQLite, etc."""

    @abstractmethod
    async def create(self, collection: str, item: dict) -> dict:
        """Create a new item in a collection."""

    @abstractmethod
    async def get(self, collection: str, item_id: str) -> dict | None:
        """Get an item by ID."""

    @abstractmethod
    async def list(self, collection: str, filters: dict[str, Any] | None = None) -> list[dict]:
        """List items, optionally filtered."""

    @abstractmethod
    async def update(self, collection: str, item_id: str, updates: dict) -> dict:
        """Update an existing item."""

    @abstractmethod
    async def delete(self, collection: str, item_id: str) -> bool:
        """Delete an item."""
