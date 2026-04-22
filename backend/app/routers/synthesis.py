"""Synthesis router.

Project-scoped surface for the v1.4.0 generator. Mounted at
``/api/synthesis``; all routes (except ``/catalog``) take a ``project_id``
path segment so the project can come from anywhere — no implicit context.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
from app.synthesis.categories import (
    CATEGORY_DESCRIPTIONS,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
)
from app.synthesis.corpus import build_corpus
from app.synthesis.critic import CriticAgent
from app.synthesis.generator import ARTIFACTS_COLLECTION, GeneratorEngine
from app.synthesis.models import (
    Artifact,
    ArtifactCreate,
    Critique,
    Question,
)
from app.synthesis.question_agent import QUESTIONS_COLLECTION, QuestionAgent
from app.synthesis.types import ARTIFACT_TYPES

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

PROJECTS_COLLECTION = "engagements"
CRITIQUES_COLLECTION = "critiques"


# ── shared helpers ──────────────────────────────────────────────────────


async def _load_project(project_id: str) -> dict:
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _project_artifacts(project_id: str) -> list[Artifact]:
    storage = get_storage_provider()
    items: list[dict] = []
    for key in ("project_id", "projectId"):
        try:
            found = await storage.list(ARTIFACTS_COLLECTION, {key: project_id})
        except Exception:
            found = []
        if found:
            items = found
            break
    return [Artifact(**i) for i in items]


async def _project_critiques(project_id: str) -> list[Critique]:
    storage = get_storage_provider()
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(CRITIQUES_COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            return [Critique(**i) for i in items]
    return []


async def _project_questions(project_id: str) -> list[Question]:
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


# ── catalog ─────────────────────────────────────────────────────────────


@router.get("/catalog")
async def get_catalog() -> dict:
    """Return the full artifact-type catalog grouped by category."""
    cats = []
    for cat in CATEGORY_ORDER:
        cats.append(
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
        )
    return {"categories": cats}


# ── per-project read ────────────────────────────────────────────────────


@router.get("/{project_id}/artifacts")
async def list_artifacts(project_id: str) -> dict:
    await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    critiques = await _project_critiques(project_id)
    crit_by_artifact = {c.artifact_id: c for c in critiques}

    return {
        "artifacts": [
            {
                **a.model_dump(mode="json"),
                "critique": (
                    crit_by_artifact[a.id].model_dump(mode="json")
                    if a.id in crit_by_artifact
                    else None
                ),
            }
            for a in artifacts
        ]
    }


@router.get("/{project_id}/sources")
async def get_sources(project_id: str) -> dict:
    project = await _load_project(project_id)
    corpus = await build_corpus(project)
    return {
        "project_id": project_id,
        "doc_count": len(corpus.docs),
        "built_at": corpus.built_at.isoformat(),
        "docs": [
            {
                "id": d.id,
                "kind": d.kind.value,
                "title": d.title,
                "uri": d.uri,
                "snippet": d.snippet,
                "last_modified": d.last_modified,
            }
            for d in corpus.docs
        ],
    }


@router.get("/{project_id}/questions")
async def list_questions(project_id: str) -> dict:
    await _load_project(project_id)
    qs = await _project_questions(project_id)
    return {"questions": [q.model_dump(mode="json") for q in qs]}


@router.get("/{project_id}/critique")
async def list_critiques(project_id: str) -> dict:
    await _load_project(project_id)
    crits = await _project_critiques(project_id)
    return {"critiques": [c.model_dump(mode="json") for c in crits]}


# ── per-project write ───────────────────────────────────────────────────


@router.post("/{project_id}/synthesize")
async def synthesize(project_id: str) -> dict:
    """Build (or rebuild) the full project synthesis: corpus, every critical
    artifact, critic pass, and questions."""
    project = await _load_project(project_id)
    corpus = await build_corpus(project)

    generator = GeneratorEngine()
    critic = CriticAgent()
    question_agent = QuestionAgent()

    artifacts: list[Artifact] = []
    failures: list[dict] = []

    for t in [t for t in ARTIFACT_TYPES if t.critical]:
        try:
            artifact = await generator.generate(project, t.id, corpus=corpus)
            artifacts.append(artifact)
        except Exception as exc:
            logger.exception("synthesize: generate %s failed", t.id)
            failures.append({"type_id": t.id, "error": str(exc)[:200]})

    # Critique in parallel — bounded fan-out
    if artifacts:
        sem = asyncio.Semaphore(3)

        async def _crit(a: Artifact):
            async with sem:
                try:
                    return await critic.critique(a, corpus)
                except Exception:
                    logger.warning("synthesize: critique failed for %s", a.id, exc_info=True)
                    return None

        await asyncio.gather(*(_crit(a) for a in artifacts))

    questions = await question_agent.generate(project, artifacts, corpus)

    return {
        "project_id": project_id,
        "corpus_doc_count": len(corpus.docs),
        "artifact_count": len(artifacts),
        "question_count": len(questions),
        "failures": failures,
    }


@router.post("/{project_id}/artifacts/{type_id}/regenerate")
async def regenerate_artifact(project_id: str, type_id: str, payload: ArtifactCreate) -> dict:
    project = await _load_project(project_id)
    if payload.type_id and payload.type_id != type_id:
        raise HTTPException(status_code=422, detail="type_id mismatch")

    corpus = await build_corpus(project)
    generator = GeneratorEngine()
    critic = CriticAgent()

    try:
        artifact = await generator.generate(
            project, type_id, payload.instructions, corpus=corpus
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("regenerate: failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc

    critique = None
    try:
        critique = await critic.critique(artifact, corpus)
    except Exception:
        logger.warning("regenerate: critique failed", exc_info=True)

    return {
        "artifact": artifact.model_dump(mode="json"),
        "critique": critique.model_dump(mode="json") if critique else None,
    }


@router.post("/{project_id}/questions/refresh")
async def refresh_questions(project_id: str) -> dict:
    project = await _load_project(project_id)
    corpus = await build_corpus(project)
    artifacts = await _project_artifacts(project_id)
    questions = await QuestionAgent().generate(project, artifacts, corpus)
    return {"questions": [q.model_dump(mode="json") for q in questions]}
