from fastapi import APIRouter, HTTPException

from app.models.core import Evidence
from app.providers.storage import get_storage_provider

router = APIRouter()
COLLECTION = "evidence"


@router.post("/", response_model=Evidence)
async def create_evidence(evidence: Evidence):
    storage = get_storage_provider()
    item = await storage.create(COLLECTION, evidence.model_dump(mode="json"))
    return Evidence(**item)


@router.get("/{discovery_id}", response_model=list[Evidence])
async def list_evidence(discovery_id: str, phase: str | None = None):
    storage = get_storage_provider()
    filters = {"discovery_id": discovery_id}
    if phase:
        filters["phase"] = phase
    items = await storage.list(COLLECTION, filters)
    return [Evidence(**item) for item in items]


@router.patch("/{evidence_id}")
async def update_evidence(evidence_id: str, updates: dict):
    storage = get_storage_provider()
    item = await storage.update(COLLECTION, evidence_id, updates)
    return Evidence(**item)


@router.delete("/{evidence_id}")
async def delete_evidence(evidence_id: str):
    storage = get_storage_provider()
    deleted = await storage.delete(COLLECTION, evidence_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return {"deleted": True}
