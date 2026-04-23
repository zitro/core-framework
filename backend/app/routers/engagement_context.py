"""Engagement Context router (v2.2).

One typed engagement-brief record per Project. GET / PUT operations
keep the DB row canonical; PUT optionally projects to
``engagement-brief.md`` inside a writable Source so the markdown view
stays in sync for human readers and offline grounding.

Endpoints
---------
- ``GET    /api/engagement-context/{project_id}``  — current record (auto-creates empty)
- ``PUT    /api/engagement-context/{project_id}``  — partial update; optional ``write_to_source_id``
- ``POST   /api/engagement-context/{project_id}/project`` — re-render markdown to a Source

The optional ``write_to_source_id`` query param triggers a brief
projection: the rendered markdown is written under
``{source_projects_dir}/{project_slug}/engagement-brief.md``. The
operation is best-effort — failures don't roll back the DB write; the
response surfaces them in ``projection``.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.dependencies import get_current_user
from app.models.customer import Source
from app.models.engagement_context import EngagementContext, EngagementContextUpdate
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create, stamp_update
from app.utils.audit_log import audit
from app.utils.engagement_brief import BRIEF_FILENAME, render_engagement_brief
from app.utils.workspace import resolve_source_projects

router = APIRouter(dependencies=[Depends(get_current_user)])
COLLECTION = "engagement_contexts"
PROJECTS_COLLECTION = "engagements"
CUSTOMERS_COLLECTION = "customers"


async def _get_or_create(project_id: str) -> dict:
    storage = get_storage_provider()
    items = await storage.list(COLLECTION)
    for it in items:
        if str(it.get("project_id")) == project_id:
            return it
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    payload = EngagementContext(
        project_id=project_id,
        customer_id=str(project.get("customer_id", "")),
        title=str(project.get("name", "")),
    ).model_dump(mode="json")
    return await storage.create(COLLECTION, stamp_create(payload))


def _project_brief_path(source: Source, customer_slug: str, project_slug: str) -> Path:
    """Compute on-disk path to the brief inside a Source."""
    projects_dir = resolve_source_projects(customer_slug, source)
    return projects_dir / project_slug / BRIEF_FILENAME


def _write_brief_sync(path: Path, markdown: str) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown, encoding="utf-8")
    return str(path)


async def _project_to_source(ctx: EngagementContext, source_id: str) -> dict:
    """Render markdown and write it to the chosen Source. Best effort."""
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, ctx.project_id)
    if not project:
        return {"written": False, "error": "Project not found"}
    customer_id = str(project.get("customer_id", "") or ctx.customer_id)
    if not customer_id:
        return {"written": False, "error": "Project has no customer_id"}
    customer = await storage.get(CUSTOMERS_COLLECTION, customer_id)
    if not customer:
        return {"written": False, "error": "Customer not found"}
    src_dict = next((s for s in (customer.get("sources") or []) if s.get("id") == source_id), None)
    if not src_dict:
        return {"written": False, "error": "Source not found on customer"}
    source = Source(**src_dict)
    if not source.writable:
        return {"written": False, "error": "Source is not writable"}
    customer_slug = str(customer.get("slug", ""))
    project_slug = str(project.get("slug", "") or ctx.project_id)
    path = _project_brief_path(source, customer_slug, project_slug)
    markdown = render_engagement_brief(ctx)
    try:
        written = await run_in_threadpool(_write_brief_sync, path, markdown)
    except OSError as exc:
        return {"written": False, "error": f"Write failed: {exc}"}
    return {"written": True, "path": written, "source_id": source_id}


@router.get("/{project_id}", response_model=EngagementContext)
async def get_context(project_id: str) -> EngagementContext:
    item = await _get_or_create(project_id)
    return EngagementContext(**item)


@router.put("/{project_id}", response_model=EngagementContext)
async def update_context(
    project_id: str,
    updates: EngagementContextUpdate,
    write_to_source_id: str | None = None,
) -> EngagementContext:
    storage = get_storage_provider()
    item = await _get_or_create(project_id)
    data = updates.model_dump(exclude_none=True, mode="json")
    if not data:
        raise HTTPException(status_code=422, detail="No valid fields to update")
    stamp_update(data)
    updated = await storage.update(COLLECTION, str(item["id"]), data)
    ctx = EngagementContext(**updated)
    projection: dict | None = None
    if write_to_source_id:
        projection = await _project_to_source(ctx, write_to_source_id)
    await audit(
        "update",
        collection=COLLECTION,
        item_id=str(item["id"]),
        summary=f"project={project_id} fields={','.join(sorted(data.keys()))}"
        + (f" projected={projection.get('written')}" if projection else ""),
        after={"projection": projection} if projection else None,
    )
    return ctx


@router.post("/{project_id}/project")
async def project_brief(project_id: str, source_id: str) -> dict:
    """Re-render the current brief markdown to a Source without DB change."""
    item = await _get_or_create(project_id)
    ctx = EngagementContext(**item)
    result = await _project_to_source(ctx, source_id)
    if not result.get("written"):
        raise HTTPException(status_code=400, detail=result.get("error", "Projection failed"))
    return result
