from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.core import Discovery, DiscoveryUpdate
from app.providers.storage import get_storage_provider

router = APIRouter(dependencies=[Depends(get_current_user)])
COLLECTION = "discoveries"


@router.post("/", response_model=Discovery, status_code=201)
async def create_discovery(discovery: Discovery):
    storage = get_storage_provider()
    item = await storage.create(COLLECTION, discovery.model_dump(mode="json"))
    return Discovery(**item)


@router.get("/", response_model=list[Discovery])
async def list_discoveries():
    storage = get_storage_provider()
    items = await storage.list(COLLECTION)
    return [Discovery(**item) for item in items]


@router.get("/{discovery_id}", response_model=Discovery)
async def get_discovery(discovery_id: str):
    storage = get_storage_provider()
    item = await storage.get(COLLECTION, discovery_id)
    if not item:
        raise HTTPException(status_code=404, detail="Discovery not found")
    return Discovery(**item)


@router.patch("/{discovery_id}", response_model=Discovery)
async def update_discovery(discovery_id: str, updates: DiscoveryUpdate):
    storage = get_storage_provider()
    # Only send fields that were explicitly set (exclude None values)
    update_data = updates.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No valid fields to update")
    try:
        item = await storage.update(COLLECTION, discovery_id, update_data)
    except ValueError:
        raise HTTPException(status_code=404, detail="Discovery not found")
    return Discovery(**item)


@router.delete("/{discovery_id}")
async def delete_discovery(discovery_id: str):
    storage = get_storage_provider()
    deleted = await storage.delete(COLLECTION, discovery_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Discovery not found")
    return {"deleted": True}
