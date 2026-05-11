"""Endpoints for listing, synthesizing, and regenerating artifacts.

GET  /{project_id}/artifacts
POST /{project_id}/synthesize
POST /{project_id}/artifacts/{type_id}/regenerate
"""

from __future__ import annotations

import logging

from fastapi import HTTPException
from pydantic import BaseModel, Field

from app.routers.synthesis._helpers import load_project, project_artifacts
from app.routers.synthesis._router import router
from app.synthesis.corpus import build_corpus
from app.synthesis.generator import GeneratorEngine
from app.synthesis.models import Artifact, ArtifactCreate
from app.synthesis.types import ARTIFACT_TYPES

logger = logging.getLogger(__name__)


@router.get("/{project_id}/artifacts")
async def list_artifacts(project_id: str) -> dict:
    """Saved Artifacts for the project."""
    await load_project(project_id)
    artifacts = await project_artifacts(project_id)
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
    type → return summary."""
    opts = payload or SynthesizePayload()
    project = await load_project(project_id)
    corpus = await build_corpus(project)

    generator = GeneratorEngine()
    candidate_types = [t for t in ARTIFACT_TYPES if t.critical or opts.include_non_critical]

    if opts.missing_only:
        existing = await project_artifacts(project_id)
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
    project = await load_project(project_id)
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
