"""Capture router — raw input → typed artifact candidates (B6).

The /capture page lets users drop in raw notes, transcripts, or pasted
context. This router exposes a *dry-run* endpoint that:

1. Sends the raw text to the LLM with the project's artifact catalog,
2. Asks the LLM to return one or more typed candidates (type_id, title,
   summary, body),
3. Diffs each candidate against existing artifacts in the DB to label it
   as ``new`` or ``replace`` (with the existing artifact id),
4. Resolves where each candidate would be projected on disk, given the
   customer's writable VERTEX source and the v2.2 3-tier path resolver.

Nothing is persisted. The UI shows the diff, the user accepts or
discards, and downstream calls (regenerate / write-back) handle the
actual writes. Keeping this endpoint side-effect-free is the whole point
— it lets the user see exactly what would happen before committing.

Routes:
    POST /api/capture/{project_id}/extract-classify
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.models.customer import Source
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.synthesis.types import ARTIFACT_TYPES
from app.utils.workspace import resolve_projects_dir, source_root

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

PROJECTS_COLLECTION = "engagements"
CUSTOMERS_COLLECTION = "customers"
ARTIFACTS_COLLECTION = "artifacts"

MAX_RAW_TEXT_CHARS = 12000
MAX_CANDIDATES = 8

EXTRACT_SYSTEM = """You are an expert engagement analyst. You read raw
input from a customer engagement (notes, transcripts, paste-ins) and
extract structured artifact candidates.

Pick artifact types ONLY from the catalog the user gives you. For each
candidate produce a short `title`, a 1–2 sentence `summary`, and a
`body` dict whose keys come from the catalog's body_schema for that
type. If the input does not support a type, do not invent it.

Return JSON with this exact shape:
{
  "candidates": [
    {
      "type_id": "<one of catalog ids>",
      "title": "...",
      "summary": "...",
      "body": { ...keys from body_schema... },
      "evidence_quote": "<short verbatim excerpt that justifies this>"
    }
  ]
}

Be conservative. Three solid candidates beats ten weak ones."""


class ExtractClassifyRequest(BaseModel):
    raw_text: str = Field(..., min_length=4)
    source_label: str = ""  # display-only, e.g. "drop-zone", "discovery call"


class CandidateDiff(BaseModel):
    type_id: str
    category: str
    title: str
    summary: str
    body: dict
    evidence_quote: str = ""
    action: str  # "new" | "replace"
    replaces_artifact_id: str = ""


class VertexPathPreview(BaseModel):
    candidate_index: int
    type_id: str
    path: str  # absolute path on disk (or empty when no writable source)
    relative_path: str = ""  # relative to writable source root
    source_id: str = ""
    available: bool = False
    reason: str = ""  # why unavailable, when available=False


class ExtractClassifyResponse(BaseModel):
    project_id: str
    candidates: list[CandidateDiff]
    db_diff: dict  # {creates: int, replaces: int}
    vertex_paths: list[VertexPathPreview]


# ── helpers ────────────────────────────────────────────────────────────


def _catalog_for_prompt() -> str:
    """Render the artifact catalog as a compact list for the LLM."""
    lines: list[str] = []
    for t in ARTIFACT_TYPES:
        keys = ", ".join(t.body_schema.keys()) or "—"
        lines.append(f"- {t.id} ({t.category}) — {t.label}: {t.description} [body keys: {keys}]")
    return "\n".join(lines)


async def _load_project(project_id: str) -> dict:
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _existing_by_type(project_id: str) -> dict[str, dict]:
    """Return latest artifact per type_id for the project."""
    storage = get_storage_provider()
    items = await storage.list(ARTIFACTS_COLLECTION, {"project_id": project_id})
    # Latest version wins per type_id.
    latest: dict[str, dict] = {}
    for it in items:
        t = it.get("type_id", "")
        if not t:
            continue
        prev = latest.get(t)
        if not prev or int(it.get("version", 0)) > int(prev.get("version", 0)):
            latest[t] = it
    return latest


def _resolve_writable_vertex(customer: dict | None) -> tuple[dict | None, str]:
    """Return (source_dict, reason_if_none)."""
    if not customer:
        return None, "no customer linked to project"
    sources = customer.get("sources") or []
    writable_vertex = [s for s in sources if s.get("writable") and s.get("role") == "vertex"]
    if not writable_vertex:
        return None, "no writable vertex source on customer"
    if len(writable_vertex) > 1:
        # UI must prompt; we don't pick for the user.
        return None, "multiple writable vertex sources — choose one in UI"
    return writable_vertex[0], ""


def _candidate_path(
    customer: dict, source: Source, project_slug: str, type_id: str, category: str
) -> Path:
    root = source_root(customer["slug"], source)
    projects_dir = resolve_projects_dir(customer["slug"], root)
    return projects_dir / project_slug / "synthesis" / category / f"{type_id}.md"


# ── routes ─────────────────────────────────────────────────────────────


@router.post(
    "/{project_id}/extract-classify",
    response_model=ExtractClassifyResponse,
)
async def extract_classify(
    project_id: str, payload: ExtractClassifyRequest
) -> ExtractClassifyResponse:
    project = await _load_project(project_id)
    raw = payload.raw_text.strip()
    if len(raw) > MAX_RAW_TEXT_CHARS:
        raw = raw[:MAX_RAW_TEXT_CHARS] + "\n…[truncated]"

    catalog = _catalog_for_prompt()
    user_prompt = (
        "Artifact catalog:\n"
        f"{catalog}\n\n"
        "Raw input" + (f" (source: {payload.source_label})" if payload.source_label else "") + ":\n"
        f"{raw}\n\n"
        "Return up to "
        f"{MAX_CANDIDATES} candidates as the JSON shape described."
    )

    llm = get_llm_provider()
    try:
        result = await llm.complete_json(EXTRACT_SYSTEM, user_prompt)
    except Exception:
        logger.exception("extract-classify: LLM call failed")
        raise HTTPException(status_code=502, detail="AI service unavailable")

    raw_candidates = (result.get("candidates") or [])[:MAX_CANDIDATES]
    valid_type_ids = {t.id: t for t in ARTIFACT_TYPES}

    existing = await _existing_by_type(project_id)
    diffs: list[CandidateDiff] = []
    creates = 0
    replaces = 0

    for c in raw_candidates:
        tid = str(c.get("type_id") or "").strip()
        if tid not in valid_type_ids:
            continue
        tdef = valid_type_ids[tid]
        prev = existing.get(tid)
        action = "replace" if prev else "new"
        if action == "new":
            creates += 1
        else:
            replaces += 1
        diffs.append(
            CandidateDiff(
                type_id=tid,
                category=str(tdef.category),
                title=str(c.get("title") or tdef.label),
                summary=str(c.get("summary") or ""),
                body=c.get("body") or {},
                evidence_quote=str(c.get("evidence_quote") or "")[:400],
                action=action,
                replaces_artifact_id=str(prev.get("id") or "") if prev else "",
            )
        )

    # Vertex projection preview — best-effort, never raises.
    vertex_paths: list[VertexPathPreview] = []
    customer_id = project.get("customer_id") or project.get("customerId") or ""
    customer = None
    if customer_id:
        storage = get_storage_provider()
        customer = await storage.get(CUSTOMERS_COLLECTION, customer_id)

    source_dict, reason = _resolve_writable_vertex(customer)
    source = Source(**source_dict) if source_dict else None
    project_slug = (
        project.get("slug") or project.get("name", "").lower().replace(" ", "-") or project_id
    )

    for idx, d in enumerate(diffs):
        if not source:
            vertex_paths.append(
                VertexPathPreview(
                    candidate_index=idx,
                    type_id=d.type_id,
                    path="",
                    available=False,
                    reason=reason or "no writable source",
                )
            )
            continue
        try:
            path = _candidate_path(customer, source, project_slug, d.type_id, d.category)
            rel = ""
            try:
                root = source_root(customer["slug"], source)
                rel = path.relative_to(root).as_posix()
            except Exception:
                rel = ""
            vertex_paths.append(
                VertexPathPreview(
                    candidate_index=idx,
                    type_id=d.type_id,
                    path=str(path),
                    relative_path=rel,
                    source_id=source.id,
                    available=True,
                )
            )
        except Exception as exc:
            logger.warning("extract-classify: path preview failed: %s", exc)
            vertex_paths.append(
                VertexPathPreview(
                    candidate_index=idx,
                    type_id=d.type_id,
                    path="",
                    available=False,
                    reason=str(exc)[:200],
                )
            )

    return ExtractClassifyResponse(
        project_id=project_id,
        candidates=diffs,
        db_diff={"creates": creates, "replaces": replaces},
        vertex_paths=vertex_paths,
    )
