"""Web/internal search endpoint backed by the configured search provider."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.search import get_search_provider

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(5, ge=1, le=20)


class SearchHit(BaseModel):
    title: str
    url: str
    snippet: str
    source: str


class SearchResponse(BaseModel):
    query: str
    enabled: bool
    results: list[SearchHit]


@router.post("/search", response_model=SearchResponse)
async def run_search(request: SearchRequest) -> SearchResponse:
    """Run a search query against the configured search provider."""
    provider = get_search_provider()
    if not provider.enabled:
        return SearchResponse(query=request.query, enabled=False, results=[])

    try:
        hits = await provider.search(request.query, limit=request.limit)
    except Exception as exc:  # noqa: BLE001 - provider errors are surfaced as 502
        logger.exception("Search provider error")
        raise HTTPException(status_code=502, detail="search provider failed") from exc

    return SearchResponse(
        query=request.query,
        enabled=True,
        results=[SearchHit(**hit.__dict__) for hit in hits],
    )
