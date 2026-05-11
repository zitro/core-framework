"""Synthesis router — Phase 6C minimal slice.

Mounted at ``/api/synthesis``. All project-scoped routes take a
``project_id`` path segment so the project comes from the URL — no
implicit context.

This is the foundation slice. It surfaces:

  - GET  /catalog                                          → ArtifactType registry
  - GET  /{project_id}/artifacts                           → list saved artifacts
  - POST /{project_id}/synthesize                          → generate critical types
  - POST /{project_id}/artifacts/{type_id}/regenerate      → regenerate one

Deferred to later sub-phases (NOT included here):
  - critic / detectors / compass     (6D)
  - chat + questions agent           (6E)
  - source connector marketplace     (6F)
  - exporters (docx/pptx)            (6J)
  - engagement-repo write-back       (Phase 7)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
from app.synthesis.categories import (
    CATEGORY_DESCRIPTIONS,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
)
from app.synthesis.corpus import build_corpus
from app.synthesis.generator import ARTIFACTS_COLLECTION, GeneratorEngine
from app.synthesis.models import Artifact, ArtifactCreate
from app.synthesis.types import ARTIFACT_TYPES

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

# Engagement-as-Project storage key. Mirrors backend/app/routers/engagements.py.
PROJECTS_COLLECTION = "engagements"


# ── helpers ─────────────────────────────────────────────────────────────


async def _load_project(project_id: str) -> dict:
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _project_artifacts(project_id: str) -> list[Artifact]:
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


# ── catalog ─────────────────────────────────────────────────────────────


@router.get("/catalog")
async def get_catalog() -> dict:
    """Return the full artifact-type catalog grouped by category."""
    return {
        "categories": [
            {
                "id": cat.value,
                "label": CATEGORY_LABELS[cat],
                "description": CATEGORY_DESCRIPTIONS[cat],
                "types": [
                    {
                        "id": t.id,
                        "label": t.label,
                        "description": t.description,
                        "critical": t.critical,
                    }
                    for t in ARTIFACT_TYPES
                    if t.category == cat
                ],
            }
            for cat in CATEGORY_ORDER
        ]
    }


# ── per-project ─────────────────────────────────────────────────────────


@router.get("/{project_id}/artifacts")
async def list_artifacts(project_id: str) -> dict:
    """Saved Artifacts for the project. Critique data is intentionally
    omitted in 6C — the critic engine lands in 6D."""
    await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    return {"artifacts": [a.model_dump(mode="json") for a in artifacts]}


class SynthesizePayload(BaseModel):
    missing_only: bool = Field(
        default=False,
        description="Skip catalog types that already have at least one artifact.",
    )
    include_non_critical: bool = Field(
        default=False,
        description="Also generate non-critical types (status updates, etc.).",
    )


@router.post("/{project_id}/synthesize")
async def synthesize(project_id: str, payload: SynthesizePayload | None = None) -> dict:
    """Build the project synthesis: corpus → generate every critical
    type → return summary. No critic, no questions, no writeback in
    6C (those land in 6D/6E/Phase 7)."""
    opts = payload or SynthesizePayload()
    project = await _load_project(project_id)
    corpus = await build_corpus(project)

    generator = GeneratorEngine()
    candidate_types = [t for t in ARTIFACT_TYPES if t.critical or opts.include_non_critical]

    if opts.missing_only:
        existing = await _project_artifacts(project_id)
        existing_type_ids = {a.type_id for a in existing}
        candidate_types = [t for t in candidate_types if t.id not in existing_type_ids]

    artifacts: list[Artifact] = []
    failures: list[dict] = []
    for t in candidate_types:
        try:
            artifact = await generator.generate(project, t.id, corpus=corpus)
            artifacts.append(artifact)
        except Exception as exc:
            logger.exception("synthesize: generate %s failed", t.id)
            failures.append({"type_id": t.id, "error": str(exc)[:200]})

    return {
        "project_id": project_id,
        "corpus_doc_count": len(corpus.docs),
        "artifact_count": len(artifacts),
        "failures": failures,
    }


@router.post("/{project_id}/artifacts/{type_id}/regenerate")
async def regenerate_artifact(project_id: str, type_id: str, payload: ArtifactCreate) -> dict:
    """Regenerate a single artifact with optional new instructions."""
    project = await _load_project(project_id)
    if payload.type_id and payload.type_id != type_id:
        raise HTTPException(status_code=422, detail="type_id mismatch")

    corpus = await build_corpus(project)
    generator = GeneratorEngine()

    try:
        artifact = await generator.generate(project, type_id, payload.instructions, corpus=corpus)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("regenerate: failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc

    return {"artifact": artifact.model_dump(mode="json")}
