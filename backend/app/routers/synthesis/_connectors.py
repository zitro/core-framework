"""Source-connector marketplace + per-project configuration.

  GET /connectors                           — static marketplace catalog
  PUT /{project_id}/connectors              — update project's connector config

A 'connector' is a source-adapter slot the user can wire credentials
into (e.g. github, msgraph, web). The marketplace endpoint surfaces
the available slots + their JSON-schema config shape so the frontend
can render a form for each. Per-project config goes onto
``project.metadata.sources`` and is read back out by each
SourceAdapter.fetch() implementation.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel

from app.providers.storage import get_storage_provider
from app.routers.synthesis._helpers import load_project
from app.routers.synthesis._router import PROJECTS_COLLECTION, router
from app.synthesis.connectors import list_connectors


@router.get("/connectors")
async def get_connectors() -> dict:
    """Marketplace catalog of source connectors. Static; no LLM call."""
    return {"connectors": list_connectors()}


class ConnectorsPayload(BaseModel):
    sources: dict[str, Any]


@router.put("/{project_id}/connectors")
async def update_project_connectors(project_id: str, payload: ConnectorsPayload) -> dict:
    """Write the per-project connector config to ``project.metadata.sources``.
    Each adapter reads its own slice on the next build_corpus call."""
    project = await load_project(project_id)
    storage = get_storage_provider()
    project.setdefault("metadata", {})
    project["metadata"]["sources"] = payload.sources
    try:
        saved = await storage.update(PROJECTS_COLLECTION, project_id, project)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {exc}") from exc
    return {"sources": (saved.get("metadata") or {}).get("sources", {})}
