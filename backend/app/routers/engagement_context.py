"""Engagement Context router (Phase 6G minimal slice).

One typed engagement-brief record per Project (a single
``EngagementContext``). The DB row is canonical; the AI uses it as
grounding context for every synthesis call (slated for a follow-up
slice that wires it into prompts.py).

Endpoints
---------
  GET  /api/engagement-context/{project_id}   current record (auto-creates empty)
  PUT  /api/engagement-context/{project_id}   partial update via EngagementContextUpdate

Deferred from master (need Phase 7 deps):
  - POST /{project_id}/auto-draft       LLM-backed auto-fill from corpus
  - POST /{project_id}/project          markdown projection to engagement-repo
  - GET  /{project_id}/versions         version history
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.engagement_context import EngagementContext, EngagementContextUpdate
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create, stamp_update

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

COLLECTION = "engagement_contexts"
PROJECTS_COLLECTION = "engagements"


async def _load_project(project_id: str) -> dict:
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_or_create(project_id: str) -> dict:
    """Load the project's EngagementContext, creating an empty row if
    none exists yet."""
    storage = get_storage_provider()
    items: list[dict] = []
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            break
    if items:
        return items[0]

    blank = EngagementContext(project_id=project_id).model_dump(mode="json")
    blank["id"] = f"ec_{uuid.uuid4().hex[:12]}"
    return await storage.create(COLLECTION, stamp_create(blank))


@router.get("/{project_id}", response_model=EngagementContext)
async def get_context(project_id: str) -> EngagementContext:
    """Fetch the typed engagement brief. Auto-creates an empty record
    if the project has none yet so the frontend always has something
    to render against."""
    await _load_project(project_id)
    raw = await _get_or_create(project_id)
    return EngagementContext(**raw)


@router.put("/{project_id}", response_model=EngagementContext)
async def update_context(project_id: str, payload: EngagementContextUpdate) -> EngagementContext:
    """Partial update. Only fields explicitly set on the payload are
    written. updated_at + updated_by are stamped automatically."""
    await _load_project(project_id)
    storage = get_storage_provider()

    current = await _get_or_create(project_id)
    patch = payload.model_dump(exclude_none=True, mode="json")
    if not patch:
        return EngagementContext(**current)

    current.update(patch)
    current["updated_at"] = datetime.now(UTC).isoformat()
    stamp_update(current)
    saved = await storage.update(COLLECTION, current["id"], current)
    return EngagementContext(**saved)
