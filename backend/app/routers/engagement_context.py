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
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.dependencies import get_current_user
from app.models.customer import Source
from app.models.engagement_context import EngagementContext, EngagementContextUpdate
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.synthesis.corpus import build_corpus
from app.synthesis.prompts import SYSTEM_FRAME, render_corpus_block
from app.utils.audit import stamp_create, stamp_update
from app.utils.audit_log import audit
from app.utils.engagement_brief import BRIEF_FILENAME, render_engagement_brief
from app.utils.workspace import resolve_source_projects

router = APIRouter(dependencies=[Depends(get_current_user)])
COLLECTION = "engagement_contexts"
VERSIONS_COLLECTION = "engagement_context_versions"
PROJECTS_COLLECTION = "engagements"
CUSTOMERS_COLLECTION = "customers"
ARTIFACTS_COLLECTION = "artifacts"


_VERSIONED_FIELDS: tuple[str, ...] = (
    "title",
    "one_liner",
    "phase",
    "problem",
    "desired_outcome",
    "scope_in",
    "scope_out",
    "constraints",
    "assumptions",
    "risks",
    "stakeholders",
    "success_metrics",
    "milestones",
    "notes",
)


def _is_empty(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list | tuple | dict):
        return len(value) == 0
    return False


def _context_is_empty(item: dict) -> bool:
    return all(_is_empty(item.get(f)) for f in _VERSIONED_FIELDS)


async def _next_version_number(project_id: str) -> int:
    storage = get_storage_provider()
    try:
        items = await storage.list(VERSIONS_COLLECTION)
    except Exception:
        return 1
    nums = [
        int(v.get("version") or 0) for v in items if str(v.get("project_id") or "") == project_id
    ]
    return (max(nums) + 1) if nums else 1


async def _snapshot(item: dict, summary: str, source: str) -> dict | None:
    """Persist the prior state of an EngagementContext as a versioned snapshot."""
    storage = get_storage_provider()
    project_id = str(item.get("project_id") or "")
    if not project_id:
        return None
    version = await _next_version_number(project_id)
    payload = {
        "project_id": project_id,
        "context_id": str(item.get("id") or ""),
        "version": version,
        "summary": summary,
        "source": source,  # "manual" | "auto-draft" | "ai-draft"
        "snapshot": {f: item.get(f) for f in _VERSIONED_FIELDS},
    }
    try:
        return await storage.create(VERSIONS_COLLECTION, stamp_create(payload))
    except Exception:
        return None


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
    # Snapshot the prior state so users can roll back / view history.
    await _snapshot(
        item,
        summary=f"updated: {','.join(sorted(data.keys()))}",
        source="manual",
    )
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


_DRAFT_SYSTEM = (
    SYSTEM_FRAME
    + "\n\nYou are drafting a project's engagement brief from its corpus.\n"
    + "Be concrete and grounded — only use facts the corpus supports.\n"
    + "If you cannot infer a field with confidence, leave it empty/null.\n"
    + "Lists should be 3-7 short bullet points (one phrase each)."
)


def _draft_user_prompt(project: dict, corpus, artifacts: list[dict]) -> str:
    name = project.get("name") or "(untitled)"
    summaries = (
        "\n".join(
            f"- {a.get('type_id')}: {a.get('title', '')} — {(a.get('summary') or '')[:200]}"
            for a in artifacts[:20]
        )
        or "(no artifacts yet)"
    )
    return f"""PROJECT NAME: {name}

EXISTING ARTIFACTS:
{summaries}

CORPUS (truncated):
{render_corpus_block(corpus, max_chars=12_000)}

Return strict JSON with this exact shape (every field optional, omit
or use null/[] when the corpus doesn't support a confident answer):
{{
  "title": "string",
  "one_liner": "string (<= 20 words)",
  "phase": "discovery|pilot|build|operate",
  "problem": "2-4 sentence narrative",
  "desired_outcome": "2-4 sentence narrative of what success looks like",
  "scope_in": ["short phrase", ...],
  "scope_out": ["short phrase", ...],
  "constraints": ["short phrase", ...],
  "assumptions": ["short phrase", ...],
  "risks": ["short phrase", ...],
  "stakeholders": [
    {{"name": "...", "role": "...", "org": "customer|internal|partner",
      "influence": "high|medium|low", "notes": "..."}}
  ],
  "success_metrics": [
    {{"name": "metric label", "target": "target value",
      "baseline": "current value", "notes": "how measured"}}
  ],
  "milestones": [
    {{"label": "milestone", "target_date": "YYYY-MM-DD or freeform", "notes": "context"}}
  ]
}}

Rules:
- Use the corpus and artifacts above; do NOT invent specifics.
- For scope/constraints/assumptions/risks: 3-7 items each, one phrase each.
- For stakeholders: only include people actually named in the corpus. Skip
  the field entirely if no real names appear. Never invent names.
- For success_metrics: only include metrics with at least a name; target/
  baseline can be empty strings if not stated.
- For milestones: only include dated or clearly sequenced events from the
  corpus. Skip if none.
- Phase defaults to "discovery" unless the corpus clearly indicates otherwise."""


_ALLOWED_PHASES = {"discovery", "pilot", "build", "operate"}
_STR_FIELDS = ("title", "one_liner", "problem", "desired_outcome")
_LIST_FIELDS = ("scope_in", "scope_out", "constraints", "assumptions", "risks")
_STAKEHOLDER_KEYS = ("name", "role", "org", "influence", "notes")
_METRIC_KEYS = ("name", "target", "baseline", "notes")
_MILESTONE_KEYS = ("label", "target_date", "notes")


def _coerce_rows(
    raw: Any, keys: tuple[str, ...], required: str, limit: int = 12
) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw[:limit]:
        if not isinstance(item, dict):
            continue
        req_val = str(item.get(required) or "").strip()
        if not req_val:
            continue
        out.append({k: str(item.get(k) or "").strip() for k in keys})
    return out


def _coerce_draft(raw: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k in _STR_FIELDS:
        v = raw.get(k)
        if isinstance(v, str) and v.strip():
            out[k] = v.strip()
    for k in _LIST_FIELDS:
        v = raw.get(k)
        if isinstance(v, list):
            cleaned = [str(x).strip() for x in v if str(x or "").strip()]
            if cleaned:
                out[k] = cleaned[:12]
    phase = raw.get("phase")
    if isinstance(phase, str) and phase.lower() in _ALLOWED_PHASES:
        out["phase"] = phase.lower()
    stakeholders = _coerce_rows(raw.get("stakeholders"), _STAKEHOLDER_KEYS, "name")
    if stakeholders:
        out["stakeholders"] = stakeholders
    metrics = _coerce_rows(raw.get("success_metrics"), _METRIC_KEYS, "name")
    if metrics:
        out["success_metrics"] = metrics
    milestones = _coerce_rows(raw.get("milestones"), _MILESTONE_KEYS, "label")
    if milestones:
        out["milestones"] = milestones
    return out


@router.post("/{project_id}/draft")
async def draft_brief(project_id: str) -> dict:
    """Use the LLM + corpus to propose values for the brief.

    Does NOT save. Returns a partial EngagementContextUpdate; the client
    decides which fields to merge into the form (typically only empty
    ones, so user edits aren't clobbered).
    """
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    corpus = await build_corpus(project)

    artifact_dicts: list[dict] = []
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(ARTIFACTS_COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            artifact_dicts = items
            break

    user_prompt = _draft_user_prompt(project, corpus, artifact_dicts)
    try:
        raw = await get_llm_provider().complete_json(_DRAFT_SYSTEM, user_prompt)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM draft failed: {exc}") from exc

    if not isinstance(raw, dict):
        raise HTTPException(status_code=502, detail="LLM returned non-object response")

    draft = _coerce_draft(raw)
    await audit(
        "draft",
        collection=COLLECTION,
        item_id=project_id,
        summary=f"project={project_id} fields={','.join(sorted(draft.keys())) or 'none'}",
    )
    return {"draft": draft, "corpus_docs": len(corpus.docs)}


@router.post("/{project_id}/auto-draft", response_model=EngagementContext)
async def auto_draft_and_save(project_id: str, force: bool = False) -> EngagementContext:
    """Run the LLM draft, fold proposals into empty fields, and save.

    Idempotent: if the brief already has any populated fields and ``force``
    is False, nothing changes. If the corpus is empty, nothing changes.
    Saves create a new version snapshot tagged ``source="auto-draft"``.
    """
    storage = get_storage_provider()
    item = await _get_or_create(project_id)
    if not force and not _context_is_empty(item):
        return EngagementContext(**item)

    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    corpus = await build_corpus(project)
    if len(corpus.docs) == 0:
        return EngagementContext(**item)

    artifact_dicts: list[dict] = []
    for key in ("project_id", "projectId"):
        try:
            items = await storage.list(ARTIFACTS_COLLECTION, {key: project_id})
        except Exception:
            items = []
        if items:
            artifact_dicts = items
            break

    user_prompt = _draft_user_prompt(project, corpus, artifact_dicts)
    try:
        raw = await get_llm_provider().complete_json(_DRAFT_SYSTEM, user_prompt)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LLM auto-draft failed: {exc}") from exc
    if not isinstance(raw, dict):
        raise HTTPException(status_code=502, detail="LLM returned non-object response")
    draft = _coerce_draft(raw)
    if not draft:
        return EngagementContext(**item)

    # Apply only to empty fields when not forced.
    apply_data: dict = {}
    for k, v in draft.items():
        if force or _is_empty(item.get(k)):
            apply_data[k] = v
    if not apply_data:
        return EngagementContext(**item)

    await _snapshot(
        item, summary=f"auto-draft: {','.join(sorted(apply_data.keys()))}", source="auto-draft"
    )
    stamp_update(apply_data)
    updated = await storage.update(COLLECTION, str(item["id"]), apply_data)
    await audit(
        "auto_draft",
        collection=COLLECTION,
        item_id=str(item["id"]),
        summary=f"project={project_id} fields={','.join(sorted(apply_data.keys()))}",
    )
    return EngagementContext(**updated)


@router.get("/{project_id}/versions")
async def list_versions(project_id: str) -> dict:
    storage = get_storage_provider()
    items = await storage.list(VERSIONS_COLLECTION)
    rows = [v for v in items if str(v.get("project_id") or "") == project_id]
    rows.sort(key=lambda v: int(v.get("version") or 0), reverse=True)
    return {
        "versions": [
            {
                "id": str(v.get("id") or ""),
                "version": int(v.get("version") or 0),
                "summary": str(v.get("summary") or ""),
                "source": str(v.get("source") or ""),
                "created_at": str(v.get("created_at") or ""),
            }
            for v in rows
        ]
    }


@router.get("/{project_id}/versions/{version_id}")
async def get_version(project_id: str, version_id: str) -> dict:
    storage = get_storage_provider()
    v = await storage.get(VERSIONS_COLLECTION, version_id)
    if not v or str(v.get("project_id") or "") != project_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return v
