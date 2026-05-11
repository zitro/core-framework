"""Critic + deterministic signals + per-category compass.

POST /{project_id}/artifacts/{artifact_id}/critique
GET  /{project_id}/signals
GET  /{project_id}/compass
"""

from __future__ import annotations

import logging

from fastapi import HTTPException

from app.routers.synthesis._helpers import (
    load_artifact,
    load_project,
    project_artifacts,
    project_critiques,
)
from app.routers.synthesis._router import router
from app.synthesis.compass import compute_compass
from app.synthesis.corpus import build_corpus
from app.synthesis.critic import CriticAgent
from app.synthesis.detectors import run_detectors

logger = logging.getLogger(__name__)


@router.post("/{project_id}/artifacts/{artifact_id}/critique")
async def critique_artifact(project_id: str, artifact_id: str) -> dict:
    """Run the critic on an existing artifact. Returns the persisted
    Critique. LLM-backed; gated behind explicit user action so the
    no-LLM local provider doesn't silently fail."""
    project = await load_project(project_id)
    artifact = await load_artifact(project_id, artifact_id)
    corpus = await build_corpus(project)
    try:
        critique = await CriticAgent().critique(artifact, corpus)
    except Exception as exc:
        logger.exception("critique: failed for %s", artifact_id)
        raise HTTPException(status_code=500, detail=f"Critique failed: {exc}") from exc
    return {"critique": critique.model_dump(mode="json")}


@router.get("/{project_id}/signals")
async def get_signals(project_id: str) -> dict:
    """Deterministic signals derived from artifacts + critiques + corpus.
    No LLM call; safe to render on every page load."""
    project = await load_project(project_id)
    artifacts = await project_artifacts(project_id)
    critiques = await project_critiques(project_id)
    corpus = await build_corpus(project)
    signals = run_detectors(artifacts, critiques, corpus)
    return {"signals": [s.model_dump(mode="json") for s in signals]}


@router.get("/{project_id}/compass")
async def get_compass(project_id: str) -> dict:
    """Per-category health rollup (green / amber / red). No LLM call."""
    project = await load_project(project_id)
    artifacts = await project_artifacts(project_id)
    critiques = await project_critiques(project_id)
    corpus = await build_corpus(project)
    signals = run_detectors(artifacts, critiques, corpus)
    snapshot = compute_compass(project_id, artifacts, signals)
    return snapshot.model_dump(mode="json")
