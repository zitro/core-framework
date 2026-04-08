import logging
import uuid
from typing import Any

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from app.config import settings
from app.providers.storage.base import StorageProvider

logger = logging.getLogger(__name__)


class CosmosStorageProvider(StorageProvider):
    """Azure Cosmos DB NoSQL storage provider with Entra ID auth."""

    def __init__(self):
        if settings.cosmos_key:
            self.client = CosmosClient(settings.cosmos_endpoint, credential=settings.cosmos_key)
        else:
            self.credential = DefaultAzureCredential()
            self.client = CosmosClient(settings.cosmos_endpoint, credential=self.credential)
        self.database = self.client.get_database_client(settings.cosmos_database)

    def _container(self, collection: str):
        return self.database.get_container_client(collection)

    async def create(self, collection: str, item: dict) -> dict:
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
        container = self._container(collection)
        result = await container.create_item(body=item)
        return dict(result)

    async def get(self, collection: str, item_id: str) -> dict | None:
        container = self._container(collection)
        try:
            result = await container.read_item(item=item_id, partition_key=item_id)
            return dict(result)
        except Exception:
            logger.debug("Item %s not found in %s", item_id, collection)
            return None

    async def list(self, collection: str, filters: dict[str, Any] | None = None) -> list[dict]:
        container = self._container(collection)
        if filters:
            conditions = " AND ".join(f"c.{k} = @{k}" for k in filters)
            params = [{"name": f"@{k}", "value": v} for k, v in filters.items()]
            query = f"SELECT * FROM c WHERE {conditions}"
            items = container.query_items(query=query, parameters=params)
        else:
            items = container.query_items(query="SELECT * FROM c")
        return [dict(item) async for item in items]

    async def update(self, collection: str, item_id: str, updates: dict) -> dict:
        container = self._container(collection)
        existing = await self.get(collection, item_id)
        if existing is None:
            raise ValueError(f"Item {item_id} not found in {collection}")
        existing.update(updates)
        result = await container.replace_item(item=item_id, body=existing)
        return dict(result)

    async def delete(self, collection: str, item_id: str) -> bool:
        container = self._container(collection)
        try:
            await container.delete_item(item=item_id, partition_key=item_id)
            return True
        except Exception:
            logger.debug("Failed to delete %s from %s", item_id, collection)
            return False
