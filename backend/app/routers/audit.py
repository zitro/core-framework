"""Audit log read API."""

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
from app.utils.audit_log import AUDIT_COLLECTION

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/")
async def list_audit(
    collection: str | None = Query(default=None),
    item_id: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict]:
    """Return the most recent audit events, newest first."""
    storage = get_storage_provider()
    filters: dict = {}
    if collection:
        filters["collection"] = collection
    if item_id:
        filters["item_id"] = item_id
    if actor:
        filters["actor"] = actor
    items = await storage.list(AUDIT_COLLECTION, filters or None)
    items.sort(key=lambda r: r.get("ts", ""), reverse=True)
    return items[:limit]
