"""Helpers shared across the synthesis router endpoints."""

from __future__ import annotations

from fastapi import HTTPException

from app.providers.storage import get_storage_provider
from app.synthesis.critic import CRITIQUES_COLLECTION
from app.synthesis.generator import ARTIFACTS_COLLECTION
from app.synthesis.models import Artifact, Critique, Question
from app.synthesis.question_agent import QUESTIONS_COLLECTION

from app.routers.synthesis._router import PROJECTS_COLLECTION


async def load_project(project_id: str) -> dict:
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def project_artifacts(project_id: str) -> list[Artifact]:
    """Load every Artifact stored for a project. Tries snake_case
    ``project_id`` partition first, then the legacy camelCase
    ``projectId`` shape used by older deployments."""
    storage = get_storage_provider()
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(ARTIFACTS_COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            return [Artifact(**i) for i in items]
    return []


async def project_critiques(project_id: str) -> list[Critique]:
    storage = get_storage_provider()
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(CRITIQUES_COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            return [Critique(**i) for i in items]
    return []


async def project_questions(project_id: str) -> list[Question]:
    storage = get_storage_provider()
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(QUESTIONS_COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            items.sort(
                key=lambda q: (
                    bool(q.get("answered")),
                    int(q.get("priority", 3)),
                )
            )
            return [Question(**i) for i in items]
    return []


async def load_artifact(project_id: str, artifact_id: str) -> Artifact:
    storage = get_storage_provider()
    raw = await storage.get(ARTIFACTS_COLLECTION, artifact_id)
    if not raw:
        raise HTTPException(status_code=404, detail="Artifact not found")
    art = Artifact(**raw)
    if art.project_id != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return art
