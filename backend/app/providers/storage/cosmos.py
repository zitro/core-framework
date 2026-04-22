import logging
import uuid
from typing import Any

from azure.cosmos import PartitionKey
from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from app.config import settings
from app.providers.storage.base import StorageProvider
from app.providers.storage.partitioning import (
    is_project_partitioned,
    partition_key_path,
)
from app.utils.project_context import get_current_project_id

logger = logging.getLogger(__name__)


class CosmosStorageProvider(StorageProvider):
    """Azure Cosmos DB NoSQL storage provider with Entra ID auth.

    Supports two partition strategies controlled by
    ``settings.cosmos_partition_strategy``:

    - ``"id"`` (legacy) — every container partitioned by ``/id``.
    - ``"project_id"`` (v1.2+) — collections in
      :data:`app.providers.storage.PARTITIONED_COLLECTIONS` are partitioned by
      ``/project_id`` for hard per-project isolation.
    """

    def __init__(self):
        if settings.cosmos_key:
            self.client = CosmosClient(settings.cosmos_endpoint, credential=settings.cosmos_key)
        else:
            self.credential = DefaultAzureCredential()
            self.client = CosmosClient(settings.cosmos_endpoint, credential=self.credential)
        self.database = self.client.get_database_client(settings.cosmos_database)

    def _container(self, collection: str):
        return self.database.get_container_client(collection)

    async def ensure_collections(self, collections: list[str]) -> None:
        """Create the database and any missing containers (idempotent).

        Picks the partition-key path per collection from ``partitioning``.
        Cosmos partition keys are immutable: switching strategy on an existing
        account requires recreating the container (manual migration).
        """
        try:
            await self.client.create_database_if_not_exists(id=settings.cosmos_database)
        except Exception:  # noqa: BLE001
            logger.warning("create_database_if_not_exists failed", exc_info=True)
        for name in collections:
            pk_path = partition_key_path(name)
            try:
                await self.database.create_container_if_not_exists(
                    id=name,
                    partition_key=PartitionKey(path=pk_path),
                )
            except Exception:  # noqa: BLE001
                logger.warning(
                    "create_container_if_not_exists(%s, pk=%s) failed",
                    name,
                    pk_path,
                    exc_info=True,
                )

    def _stamp_project_id(self, collection: str, item: dict) -> dict:
        """If collection is project-partitioned, ensure item carries project_id."""
        if not is_project_partitioned(collection):
            return item
        if not item.get("project_id"):
            pid = get_current_project_id()
            if not pid:
                raise ValueError(
                    f"Cannot write to project-partitioned collection {collection!r} "
                    "without an active X-Project-Id (set the header on the request)."
                )
            item["project_id"] = pid
        return item

    def _pk_for_read(self, collection: str, item_id: str) -> str:
        """Resolve the partition-key value for a read/delete by id."""
        if is_project_partitioned(collection):
            pid = get_current_project_id()
            if not pid:
                raise ValueError(
                    f"Cannot read from project-partitioned collection {collection!r} "
                    "without an active X-Project-Id."
                )
            return pid
        return item_id

    async def create(self, collection: str, item: dict) -> dict:
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
        item = self._stamp_project_id(collection, item)
        container = self._container(collection)
        result = await container.create_item(body=item)
        return dict(result)

    async def get(self, collection: str, item_id: str) -> dict | None:
        container = self._container(collection)
        try:
            pk = self._pk_for_read(collection, item_id)
            result = await container.read_item(item=item_id, partition_key=pk)
            return dict(result)
        except Exception:
            logger.debug("Item %s not found in %s", item_id, collection)
            return None

    async def list(self, collection: str, filters: dict[str, Any] | None = None) -> list[dict]:
        container = self._container(collection)
        # Auto-scope to active project for partitioned collections.
        scoped = dict(filters or {})
        if is_project_partitioned(collection):
            pid = get_current_project_id()
            if pid:
                scoped.setdefault("project_id", pid)
        if scoped:
            conditions = " AND ".join(f"c.{k} = @{k}" for k in scoped)
            params = [{"name": f"@{k}", "value": v} for k, v in scoped.items()]
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
        # project_id is part of the partition key — never allow it to change.
        if is_project_partitioned(collection):
            existing["project_id"] = self._pk_for_read(collection, item_id)
        result = await container.replace_item(item=item_id, body=existing)
        return dict(result)

    async def delete(self, collection: str, item_id: str) -> bool:
        container = self._container(collection)
        try:
            pk = self._pk_for_read(collection, item_id)
            await container.delete_item(item=item_id, partition_key=pk)
            return True
        except Exception:
            logger.debug("Failed to delete %s from %s", item_id, collection)
            return False
