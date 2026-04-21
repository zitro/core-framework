"""Engagements router — multi-engagement workspace for FDE/MCAPS workflows."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.core import Engagement, EngagementUpdate
from app.providers.storage import get_storage_provider

router = APIRouter(dependencies=[Depends(get_current_user)])
COLLECTION = "engagements"


@router.post("/", response_model=Engagement, status_code=201)
async def create_engagement(engagement: Engagement) -> Engagement:
    storage = get_storage_provider()
    item = await storage.create(COLLECTION, engagement.model_dump(mode="json"))
    return Engagement(**item)


@router.get("/", response_model=list[Engagement])
async def list_engagements() -> list[Engagement]:
    storage = get_storage_provider()
    items = await storage.list(COLLECTION)
    return [Engagement(**item) for item in items]


@router.get("/{engagement_id}", response_model=Engagement)
async def get_engagement(engagement_id: str) -> Engagement:
    storage = get_storage_provider()
    item = await storage.get(COLLECTION, engagement_id)
    if not item:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return Engagement(**item)


@router.patch("/{engagement_id}", response_model=Engagement)
async def update_engagement(engagement_id: str, updates: EngagementUpdate) -> Engagement:
    storage = get_storage_provider()
    update_data = updates.model_dump(exclude_none=True, mode="json")
    if not update_data:
        raise HTTPException(status_code=422, detail="No valid fields to update")
    update_data["updated_at"] = datetime.now(UTC).isoformat()
    try:
        item = await storage.update(COLLECTION, engagement_id, update_data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Engagement not found") from exc
    return Engagement(**item)


@router.delete("/{engagement_id}")
async def delete_engagement(engagement_id: str) -> dict:
    storage = get_storage_provider()
    deleted = await storage.delete(COLLECTION, engagement_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Engagement not found")
    return {"deleted": True}


@router.post("/{engagement_id}/discoveries/{discovery_id}", response_model=Engagement)
async def attach_discovery(engagement_id: str, discovery_id: str) -> Engagement:
    storage = get_storage_provider()
    item = await storage.get(COLLECTION, engagement_id)
    if not item:
        raise HTTPException(status_code=404, detail="Engagement not found")
    ids = list(item.get("discovery_ids") or [])
    if discovery_id not in ids:
        ids.append(discovery_id)
    updated = await storage.update(
        COLLECTION,
        engagement_id,
        {"discovery_ids": ids, "updated_at": datetime.now(UTC).isoformat()},
    )
    return Engagement(**updated)


@router.delete("/{engagement_id}/discoveries/{discovery_id}", response_model=Engagement)
async def detach_discovery(engagement_id: str, discovery_id: str) -> Engagement:
    storage = get_storage_provider()
    item = await storage.get(COLLECTION, engagement_id)
    if not item:
        raise HTTPException(status_code=404, detail="Engagement not found")
    ids = [d for d in (item.get("discovery_ids") or []) if d != discovery_id]
    updated = await storage.update(
        COLLECTION,
        engagement_id,
        {"discovery_ids": ids, "updated_at": datetime.now(UTC).isoformat()},
    )
    return Engagement(**updated)
