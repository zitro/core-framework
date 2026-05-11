"""Synthesis router — 6C/6D/6E surface.

Mounted at ``/api/synthesis``. All project-scoped routes take a
``project_id`` path segment so the project comes from the URL — no
implicit context.

Surface so far:

  - GET  /catalog                                          → ArtifactType registry
  - GET  /{project_id}/artifacts                           → list saved artifacts
  - POST /{project_id}/synthesize                          → generate critical types
  - POST /{project_id}/artifacts/{artifact_id}/critique    → run critic (6D)
  - GET  /{project_id}/signals                             → deterministic signals (6D)
  - GET  /{project_id}/compass                             → per-category health (6D)
  - POST /{project_id}/chat                                → corpus-grounded chat (6E)
  - GET  /{project_id}/chat                                → list chat turns (6E)
  - POST /{project_id}/questions/refresh                   → regenerate questions (6E)
  - GET  /{project_id}/questions                           → list customer questions (6E)
  - POST /{project_id}/artifacts/{type_id}/regenerate      → regenerate one

Deferred to later sub-phases (NOT included here):
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
from app.synthesis.chat import CHATS_COLLECTION, ChatAgent
from app.synthesis.compass import compute_compass
from app.synthesis.corpus import build_corpus
from app.synthesis.critic import CRITIQUES_COLLECTION, CriticAgent
from app.synthesis.detectors import run_detectors
from app.synthesis.generator import ARTIFACTS_COLLECTION, GeneratorEngine
from app.synthesis.models import Artifact, ArtifactCreate, Critique, Question
from app.synthesis.question_agent import QUESTIONS_COLLECTION, QuestionAgent
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


async def _load_artifact(project_id: str, artifact_id: str) -> Artifact:
    storage = get_storage_provider()
    raw = await storage.get(ARTIFACTS_COLLECTION, artifact_id)
    if not raw:
        raise HTTPException(status_code=404, detail="Artifact not found")
    art = Artifact(**raw)
    if art.project_id != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return art


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


@router.post("/{project_id}/artifacts/{artifact_id}/critique")
async def critique_artifact(project_id: str, artifact_id: str) -> dict:
    """Run the critic on an existing artifact. Returns the persisted
    Critique. LLM-backed; gated behind explicit user action so the
    no-LLM local provider doesn't silently fail."""
    project = await _load_project(project_id)
    artifact = await _load_artifact(project_id, artifact_id)
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
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    critiques = await _project_critiques(project_id)
    corpus = await build_corpus(project)
    signals = run_detectors(artifacts, critiques, corpus)
    return {
        "signals": [s.model_dump(mode="json") for s in signals],
    }


@router.get("/{project_id}/compass")
async def get_compass(project_id: str) -> dict:
    """Per-category health rollup (green / amber / red) derived from
    artifacts + critiques + deterministic signals. No LLM call."""
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    critiques = await _project_critiques(project_id)
    corpus = await build_corpus(project)
    signals = run_detectors(artifacts, critiques, corpus)
    snapshot = compute_compass(project_id, artifacts, signals)
    return snapshot.model_dump(mode="json")


class ChatPayload(BaseModel):
    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=10_000)


@router.post("/{project_id}/chat")
async def chat(project_id: str, payload: ChatPayload) -> dict:
    """Send a user message in a session, get a corpus-grounded reply.
    LLM-backed; user-initiated, never auto-fired."""
    project = await _load_project(project_id)
    corpus = await build_corpus(project)

    # Reconstruct session history from previously-persisted turns.
    storage = get_storage_provider()
    raw_turns: list[dict] = []
    for key in ("project_id", "projectId"):
        try:
            raw_turns = await storage.list(
                CHATS_COLLECTION,
                {key: project_id, "session_id": payload.session_id},
            )
        except Exception:
            raw_turns = []
        if raw_turns:
            break
    history = [
        {"role": t.get("role", "user"), "content": t.get("content", "")}
        for t in sorted(raw_turns, key=lambda t: t.get("created_at", ""))
    ]

    try:
        result = await ChatAgent().reply(
            project, payload.session_id, payload.message, corpus, history
        )
    except Exception as exc:
        logger.exception("chat: failed for session=%s", payload.session_id)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc
    return result


@router.get("/{project_id}/chat")
async def list_chat_turns(project_id: str, session_id: str | None = None) -> dict:
    """List chat turns for a project, optionally filtered to one session."""
    await _load_project(project_id)
    storage = get_storage_provider()
    filters: dict = {"project_id": project_id}
    if session_id:
        filters["session_id"] = session_id
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(CHATS_COLLECTION, {**filters, key: project_id})
        except Exception:
            items = []
        if items:
            break
    items.sort(key=lambda t: t.get("created_at", ""))
    return {"turns": items}


# ── questions ──────────────────────────────────────────────────────────


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


@router.post("/{project_id}/questions/refresh")
async def refresh_questions(project_id: str) -> dict:
    """Regenerate the customer-questions list. LLM-backed; user-initiated."""
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    corpus = await build_corpus(project)
    questions = await QuestionAgent().generate(project, artifacts, corpus)
    return {
        "project_id": project_id,
        "question_count": len(questions),
        "questions": [q.model_dump(mode="json") for q in questions],
    }


@router.get("/{project_id}/questions")
async def list_questions(project_id: str) -> dict:
    """Saved customer questions for the project."""
    await _load_project(project_id)
    questions = await _project_questions(project_id)
    return {"questions": [q.model_dump(mode="json") for q in questions]}


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
