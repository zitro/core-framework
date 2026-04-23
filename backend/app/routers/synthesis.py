"""Synthesis router.

Project-scoped surface for the v1.4.0 generator. Mounted at
``/api/synthesis``; all routes (except ``/catalog``) take a ``project_id``
path segment so the project can come from anywhere — no implicit context.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
from app.synthesis.categories import (
    CATEGORY_DESCRIPTIONS,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
)
from app.synthesis.chat import CHATS_COLLECTION, ChatAgent
from app.synthesis.compass import compute_compass, types_to_auto_regenerate
from app.synthesis.connectors import list_connectors
from app.synthesis.corpus import build_corpus
from app.synthesis.critic import CriticAgent
from app.synthesis.detectors import run_detectors, summarise
from app.synthesis.exporters import export_docx, export_pptx
from app.synthesis.generator import ARTIFACTS_COLLECTION, GeneratorEngine
from app.synthesis.models import (
    Artifact,
    ArtifactCreate,
    Critique,
    Question,
)
from app.synthesis.question_agent import QUESTIONS_COLLECTION, QuestionAgent
from app.synthesis.types import ARTIFACT_TYPES
from app.synthesis.writers import VertexWriteBack

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

    writeback = await VertexWriteBack().push(project, artifacts)

    return {
        "project_id": project_id,
        "corpus_doc_count": len(corpus.docs),
        "artifact_count": len(artifacts),
        "question_count": len(questions),
        "failures": failures,
        "writeback": {"vertex": writeback.to_dict()},
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
        artifact = await generator.generate(project, type_id, payload.instructions, corpus=corpus)
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


# ── exports ─────────────────────────────────────────────────────────────


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-") or "synthesis"
    return cleaned[:80]


def _filename(project: dict, ext: str) -> str:
    base = str(project.get("slug") or project.get("name") or project.get("id") or "synthesis")
    return f"{_safe_filename(base)}-synthesis.{ext}"


@router.get("/{project_id}/export/docx")
async def export_docx_endpoint(project_id: str) -> Response:
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    if not artifacts:
        raise HTTPException(status_code=404, detail="No artifacts to export")
    payload = export_docx(project, artifacts)
    return Response(
        content=payload,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{_filename(project, "docx")}"'},
    )


@router.get("/{project_id}/export/pptx")
async def export_pptx_endpoint(project_id: str) -> Response:
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    if not artifacts:
        raise HTTPException(status_code=404, detail="No artifacts to export")
    payload = export_pptx(project, artifacts)
    return Response(
        content=payload,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{_filename(project, "pptx")}"'},
    )


# ── write-back ──────────────────────────────────────────────────────────


@router.post("/{project_id}/writeback/vertex")
async def writeback_vertex(project_id: str) -> dict:
    """Push the current set of generated artifacts back to the connected
    vertex repo. No-op (with explanatory payload) when write-back is not
    enabled in ``project.metadata.vertex.write_enabled``."""
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    result = await VertexWriteBack().push(project, artifacts)
    return result.to_dict()


@router.post("/{project_id}/artifacts/{artifact_id}/push")
async def push_artifact(project_id: str, artifact_id: str) -> dict:
    """Push a single artifact back to the connected vertex repo. Wraps
    :class:`VertexWriteBack` with a 1-element artifact list so callers
    can ship a card from the Refine view without exporting the full set.
    """
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    target = next((a for a in artifacts if a.id == artifact_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    result = await VertexWriteBack().push(project, [target])
    return result.to_dict()


# ── chat over corpus ────────────────────────────────────────────────────


class ChatTurn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str = ""


@router.post("/{project_id}/chat")
async def chat(project_id: str, payload: ChatTurn) -> dict:
    """Answer a user message strictly from the project corpus. Persists
    both the user turn and the assistant reply in ``synthesis_chats``."""
    project = await _load_project(project_id)
    corpus = await build_corpus(project)

    session_id = payload.session_id.strip() or str(uuid.uuid4())
    history = await _chat_history(project_id, session_id)

    agent = ChatAgent()
    try:
        result = await agent.reply(
            project,
            session_id,
            payload.message,
            corpus,
            history=[
                {"role": h.get("role", "user"), "content": h.get("content", "")} for h in history
            ],
        )
    except Exception as exc:
        logger.exception("chat: agent reply failed")
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}") from exc
    return result


@router.get("/{project_id}/chat/{session_id}")
async def get_chat(project_id: str, session_id: str) -> dict:
    await _load_project(project_id)
    turns = await _chat_history(project_id, session_id)
    return {"session_id": session_id, "turns": turns}


@router.get("/{project_id}/chat")
async def list_chats(project_id: str) -> dict:
    """Return distinct session ids with their first/last turn timestamps."""
    await _load_project(project_id)
    turns = await _chat_history(project_id)
    sessions: dict[str, dict] = {}
    for t in turns:
        sid = str(t.get("session_id") or "")
        if not sid:
            continue
        s = sessions.setdefault(
            sid,
            {"session_id": sid, "started_at": t.get("created_at"), "turns": 0, "last_at": ""},
        )
        s["turns"] += 1
        ts = t.get("created_at") or ""
        if ts > s.get("last_at", ""):
            s["last_at"] = ts
        if ts < (s.get("started_at") or ts):
            s["started_at"] = ts
    return {"sessions": sorted(sessions.values(), key=lambda s: s["last_at"], reverse=True)}


async def _chat_history(project_id: str, session_id: str | None = None) -> list[dict]:
    storage = get_storage_provider()
    for key in ("project_id", "projectId"):
        try:
            if session_id:
                items = await storage.list(
                    CHATS_COLLECTION,
                    {key: project_id, "session_id": session_id},
                )
            else:
                items = await storage.list(CHATS_COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            return sorted(items, key=lambda i: i.get("created_at", ""))
    return []


# ── project metadata (vertex toggles, etc.) ────────────────────────────


class VertexSettings(BaseModel):
    write_enabled: bool
    write_subdir: str | None = None


@router.put("/{project_id}/settings/vertex")
async def update_vertex_settings(project_id: str, payload: VertexSettings) -> dict:
    """Update the project's vertex write-back metadata.

    Stored at ``project.metadata.vertex`` so the existing read paths
    (``VertexWriteBack``) pick it up without further wiring.
    """
    project = await _load_project(project_id)
    storage = get_storage_provider()
    metadata = dict(project.get("metadata") or {})
    vertex_meta = dict(metadata.get("vertex") or {})
    vertex_meta["write_enabled"] = bool(payload.write_enabled)
    if payload.write_subdir is not None:
        cleaned = payload.write_subdir.strip().strip("/\\")
        vertex_meta["write_subdir"] = cleaned or None
    metadata["vertex"] = vertex_meta
    project["metadata"] = metadata
    saved = await storage.update(PROJECTS_COLLECTION, project_id, project)
    return {"vertex": (saved.get("metadata") or {}).get("vertex") or {}}


# ── detectors / signals ───────────────────────────────────────


@router.get("/{project_id}/signals")
async def get_signals(project_id: str) -> dict:
    """Run all detector rules and return signals sorted by severity.

    Computed on-demand from the current artifacts, critiques, and corpus
    — not persisted. Each signal carries a deterministic id so the UI
    can de-duplicate across refreshes.
    """
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    critiques = await _project_critiques(project_id)
    corpus = await build_corpus(project)
    signals = run_detectors(artifacts, critiques, corpus)
    return {
        "project_id": project_id,
        "counts": summarise(signals),
        "signals": [s.model_dump(mode="json") for s in signals],
    }


# ── compass / operational ─────────────────────────────────────


@router.get("/{project_id}/compass")
async def get_compass(project_id: str) -> dict:
    """Per-category health snapshot. Pure function of artifacts + signals."""
    project = await _load_project(project_id)
    artifacts = await _project_artifacts(project_id)
    critiques = await _project_critiques(project_id)
    corpus = await build_corpus(project)
    signals = run_detectors(artifacts, critiques, corpus)
    snapshot = compute_compass(project_id, artifacts, signals)
    return snapshot.model_dump(mode="json")


class OperationalSettings(BaseModel):
    auto_rebuild: bool


@router.put("/{project_id}/settings/operational")
async def update_operational_settings(project_id: str, payload: OperationalSettings) -> dict:
    """Toggle the project's auto-rebuild flag.

    Stored at ``project.metadata.auto_rebuild`` so ``sources/refresh``
    picks it up on the next call.
    """
    project = await _load_project(project_id)
    storage = get_storage_provider()
    metadata = dict(project.get("metadata") or {})
    metadata["auto_rebuild"] = bool(payload.auto_rebuild)
    project["metadata"] = metadata
    saved = await storage.update(PROJECTS_COLLECTION, project_id, project)
    return {
        "auto_rebuild": bool((saved.get("metadata") or {}).get("auto_rebuild")),
    }


@router.post("/{project_id}/sources/refresh")
async def refresh_sources(project_id: str) -> dict:
    """Rebuild the corpus from configured sources, then optionally auto-regen.

    When ``project.metadata.auto_rebuild`` is true, any artifact tied to
    a stale-vs-corpus or broken-citation signal is regenerated against
    the freshly built corpus. We deliberately leave low-grounding and
    contradiction signals alone — those usually need human input.
    """
    project = await _load_project(project_id)
    corpus = await build_corpus(project)

    auto = bool((project.get("metadata") or {}).get("auto_rebuild"))
    regenerated: list[str] = []
    failures: list[dict] = []

    if auto:
        artifacts = await _project_artifacts(project_id)
        critiques = await _project_critiques(project_id)
        signals = run_detectors(artifacts, critiques, corpus)
        targets = types_to_auto_regenerate(signals)
        if targets:
            generator = GeneratorEngine()
            for type_id in targets:
                try:
                    await generator.generate(project, type_id, "", corpus=corpus)
                    regenerated.append(type_id)
                except Exception as exc:  # pragma: no cover - logged below
                    logger.warning("sources/refresh: regen %s failed", type_id, exc_info=True)
                    failures.append({"type_id": type_id, "error": str(exc)})

    return {
        "project_id": project_id,
        "source_count": len(corpus.docs),
        "auto_rebuild": auto,
        "regenerated": regenerated,
        "failures": failures,
    }


# ── connector marketplace ───────────────────────────────────


@router.get("/connectors")
async def get_connectors() -> dict:
    """Static metadata + JSON-schema for every shipped source adapter."""
    return {"connectors": list_connectors()}


class ConnectorConfigUpdate(BaseModel):
    kind: str
    config: dict


@router.put("/{project_id}/connectors")
async def update_connector_config(project_id: str, payload: ConnectorConfigUpdate) -> dict:
    """Set per-project config for a single connector kind.

    Stored under ``project.metadata.sources.<kind>``. Pass an empty
    config dict to clear.
    """
    valid_kinds = {c["kind"] for c in list_connectors()}
    if payload.kind not in valid_kinds:
        raise HTTPException(status_code=422, detail=f"unknown connector: {payload.kind}")

    project = await _load_project(project_id)
    storage = get_storage_provider()
    metadata = dict(project.get("metadata") or {})
    sources = dict(metadata.get("sources") or {})
    if payload.config:
        sources[payload.kind] = payload.config
    else:
        sources.pop(payload.kind, None)
    metadata["sources"] = sources
    project["metadata"] = metadata
    saved = await storage.update(PROJECTS_COLLECTION, project_id, project)
    return {
        "sources": (saved.get("metadata") or {}).get("sources") or {},
    }
