"""Helpers for picking the Cosmos partition key path and value per collection."""

from __future__ import annotations

from app.config import settings
from app.providers.storage import PARTITIONED_COLLECTIONS


def partition_key_path(collection: str) -> str:
    """Return the Cosmos partition-key *path* for a collection.

    Used by ``ensure_collections`` when (re)creating containers.
    """
    if settings.cosmos_partition_strategy == "project_id" and collection in PARTITIONED_COLLECTIONS:
        return "/project_id"
    return "/id"


def is_project_partitioned(collection: str) -> bool:
    """True when this collection's partition key is ``/project_id``."""
    return (
        settings.cosmos_partition_strategy == "project_id" and collection in PARTITIONED_COLLECTIONS
    )


def partition_key_value(collection: str, item: dict, *, fallback_id: str | None = None) -> str:
    """Pick the partition-key *value* for a read/write op against this collection.

    For project-partitioned collections, returns the item's ``project_id``.
    For id-partitioned collections, returns ``item['id']`` or ``fallback_id``.
    """
    if is_project_partitioned(collection):
        pid = item.get("project_id") if item else None
        if pid:
            return str(pid)
        # Caller must have set project_id already; raise to surface bugs early.
        raise ValueError(
            f"Collection {collection!r} is partitioned by /project_id but item has no project_id"
        )
    return str(item.get("id") if item else None) or str(fallback_id or "")
