"""Microsoft Graph router — read-only access to files, messages, meetings."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.providers.graph import get_graph_provider

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/status")
async def status() -> dict:
    provider = get_graph_provider()
    return {"enabled": provider.enabled}


@router.get("/files")
async def search_files(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, ge=1, le=25),
) -> dict:
    provider = get_graph_provider()
    items = await provider.search_files(q, limit=limit)
    return {"enabled": provider.enabled, "query": q, "items": [asdict(i) for i in items]}


@router.get("/messages")
async def search_messages(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, ge=1, le=25),
) -> dict:
    provider = get_graph_provider()
    items = await provider.search_messages(q, limit=limit)
    return {"enabled": provider.enabled, "query": q, "items": [asdict(i) for i in items]}


@router.get("/meetings")
async def list_meetings(
    days: int = Query(default=7, ge=1, le=60),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict:
    provider = get_graph_provider()
    items = await provider.list_meetings(days=days, limit=limit)
    return {"enabled": provider.enabled, "items": [asdict(i) for i in items]}
