"""Dynamics 365 / Dataverse router — read-only account lookup."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.providers.dynamics import get_dynamics_provider

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/status")
async def status() -> dict:
    provider = get_dynamics_provider()
    return {"enabled": provider.enabled}


@router.get("/accounts")
async def search_accounts(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, ge=1, le=50),
) -> dict:
    provider = get_dynamics_provider()
    items = await provider.search_accounts(q, limit=limit)
    return {"enabled": provider.enabled, "query": q, "items": [asdict(i) for i in items]}


@router.get("/accounts/{account_id}")
async def get_account(account_id: str) -> dict:
    provider = get_dynamics_provider()
    item = await provider.get_account(account_id)
    if not item:
        raise HTTPException(status_code=404, detail="Account not found or provider disabled")
    return asdict(item)
