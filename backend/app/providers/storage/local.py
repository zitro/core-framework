import json
import re
import uuid
from pathlib import Path
from typing import Any

from app.config import settings
from app.providers.storage.base import StorageProvider

# Only allow alphanumeric, hyphens, and underscores in identifiers
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_name(value: str, label: str) -> str:
    """Reject path traversal and invalid characters in collection/item names."""
    if not value or not _SAFE_NAME.match(value):
        raise ValueError(f"Invalid {label}: must be alphanumeric, hyphens, or underscores")
    return value


class LocalStorageProvider(StorageProvider):
    """File-based JSON storage for local development. No external dependencies."""

    def __init__(self):
        self.base_path = Path(settings.local_storage_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _collection_path(self, collection: str) -> Path:
        _validate_name(collection, "collection name")
        path = self.base_path / collection
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def ensure_collections(self, collections: list[str]) -> None:
        for name in collections:
            self._collection_path(name)

    async def create(self, collection: str, item: dict) -> dict:
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
        _validate_name(item["id"], "item ID")
        path = self._collection_path(collection) / f"{item['id']}.json"
        path.write_text(json.dumps(item, indent=2, default=str), encoding="utf-8")
        return item

    async def get(self, collection: str, item_id: str) -> dict | None:
        _validate_name(item_id, "item ID")
        path = self._collection_path(collection) / f"{item_id}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    async def list(self, collection: str, filters: dict[str, Any] | None = None) -> list[dict]:
        col_path = self._collection_path(collection)
        items = []
        for file in col_path.glob("*.json"):
            item = json.loads(file.read_text(encoding="utf-8"))
            if filters:
                if all(item.get(k) == v for k, v in filters.items()):
                    items.append(item)
            else:
                items.append(item)
        return items

    async def update(self, collection: str, item_id: str, updates: dict) -> dict:
        _validate_name(item_id, "item ID")
        item = await self.get(collection, item_id)
        if item is None:
            raise ValueError(f"Item {item_id} not found in {collection}")
        item.update(updates)
        path = self._collection_path(collection) / f"{item_id}.json"
        path.write_text(json.dumps(item, indent=2, default=str), encoding="utf-8")
        return item

    async def delete(self, collection: str, item_id: str) -> bool:
        _validate_name(item_id, "item ID")
        path = self._collection_path(collection) / f"{item_id}.json"
        if path.exists():
            path.unlink()
            return True
        return False
