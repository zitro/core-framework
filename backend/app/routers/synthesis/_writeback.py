"""Engagement-repo write-back endpoints.

POST /{project_id}/writeback/engagement-repo
POST /{project_id}/artifacts/{artifact_id}/push
PUT  /{project_id}/settings/engagement-repo

Write-back is opt-in via project metadata. See
``app.synthesis.writers.vertex`` for filesystem semantics.
"""

from __future__ import annotations

from fastapi import HTTPException
from pydantic import BaseModel

from app.providers.storage import get_storage_provider
from app.routers.synthesis._helpers import load_project, project_artifacts
from app.routers.synthesis._router import PROJECTS_COLLECTION, router
from app.synthesis.writers import VertexWriteBack


@router.post("/{project_id}/writeback/engagement-repo")
async def writeback_vertex(project_id: str) -> dict:
    """Push every saved artifact for a project to the engagement-repo clone.

    No-op (returns ``enabled: false``) when write-back hasn't been opted
    into via ``project.metadata.engagement-repo.write_enabled``.
    """
    project = await load_project(project_id)
    artifacts = await project_artifacts(project_id)
    result = await VertexWriteBack().push(project, artifacts)
    return result.to_dict()


@router.post("/{project_id}/artifacts/{artifact_id}/push")
async def push_artifact(project_id: str, artifact_id: str) -> dict:
    """Push a single artifact to the engagement-repo clone."""
    project = await load_project(project_id)
    artifacts = await project_artifacts(project_id)
    target = next((a for a in artifacts if a.id == artifact_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    result = await VertexWriteBack().push(project, [target])
    return result.to_dict()


class VertexSettings(BaseModel):
    write_enabled: bool
    write_subdir: str | None = None


@router.put("/{project_id}/settings/engagement-repo")
async def update_vertex_settings(project_id: str, payload: VertexSettings) -> dict:
    """Persist write-back metadata on the project."""
    project = await load_project(project_id)
    storage = get_storage_provider()
    metadata = dict(project.get("metadata") or {})
    vertex_meta = dict(metadata.get("engagement-repo") or {})
    vertex_meta["write_enabled"] = bool(payload.write_enabled)
    if payload.write_subdir is not None:
        cleaned = payload.write_subdir.strip().strip("/\\")
        vertex_meta["write_subdir"] = cleaned or None
    metadata["engagement-repo"] = vertex_meta
    project["metadata"] = metadata
    saved = await storage.update(PROJECTS_COLLECTION, project_id, project)
    return {
        "engagement-repo": (saved.get("metadata") or {}).get("engagement-repo") or {},
    }
