"""Engagement repo router — scan, preview, ingest, and export."""

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
from app.config import settings
from app.utils.engagement import (
    _find_content_dir,
    read_engagement_content_structured,
    scan_engagement_repo,
)
from app.utils.engagement_export import (
    render_blueprint,
    render_company_profile,
    render_empathy_map,
    render_hmw_board,
    render_problem_statement,
    render_use_case,
)
from app.utils.file_extract import (
    SUPPORTED_EXTENSIONS,
    ExtractionError,
    UnsupportedFileTypeError,
    extract_to_markdown,
)
from app.utils.ingest import classify_and_place, write_classified_content
from app.utils.project_paths import resolve_project_repo_path
from app.utils.github_oauth_store import get_session
from app.utils.repo_source import (
    RepoSourceError,
    delete_github_repo_source_cache,
    ensure_github_repo_source,
    is_github_repo_url,
    normalize_github_repo_source,
)
from app.utils.references import regenerate_references
from app.utils.review_gate import latest_status

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


class RepoPathRequest(BaseModel):
    path: str
    refresh: bool = False


class ExportRequest(BaseModel):
    discovery_id: str
    repo_path: str
    project_dir: str = ""


class IngestClassifyRequest(BaseModel):
    repo_path: str
    content: str


class IngestWriteRequest(BaseModel):
    content_dir: str
    directory: str = ""
    filename: str
    content: str
    action: str = "create"
    append_target: str = ""


class PublishRequest(BaseModel):
    discovery_id: str
    repo_paths: list[str] = []
    dry_run: bool = True
    use_ai_placement: bool = True


class SourceDeleteRequest(BaseModel):
    discovery_id: str
    source_type: str
    source_value: str
    purge_cached_data: bool = True


def _github_token_from_request(request: Request) -> str | None:
    # Priority: explicit header for API clients, then OAuth session cookie.
    explicit = str(request.headers.get("x-github-token", "")).strip()
    if explicit:
        return explicit
    sid = request.cookies.get(settings.github_oauth_cookie_name)
    session = get_session(sid)
    if not session:
        return None
    token, _login = session
    return token


def _resolve_repo_root(
    source: str,
    github_token: str | None = None,
    *,
    refresh: bool = False,
) -> Path:
    value = str(source or "").strip()
    if is_github_repo_url(value):
        try:
            return ensure_github_repo_source(value, oauth_token=github_token, refresh=refresh)
        except RepoSourceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return resolve_project_repo_path(value)


@router.post("/scan")
async def scan_repo(payload: RepoPathRequest, request: Request):
    """Scan an engagement repo directory and return its structure.

    ``path`` may be absolute or relative to ``settings.projects_root``.
    """
    root = _resolve_repo_root(
        payload.path,
        _github_token_from_request(request),
        refresh=payload.refresh,
    )
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    return await asyncio.to_thread(scan_engagement_repo, str(root))


@router.post("/content")
async def get_content(payload: RepoPathRequest, request: Request):
    """Return full parsed content from an engagement repo for frontend rendering."""
    root = _resolve_repo_root(
        payload.path,
        _github_token_from_request(request),
        refresh=payload.refresh,
    )
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    result = await asyncio.to_thread(read_engagement_content_structured, str(root))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/ingest/classify")
async def ingest_classify(payload: IngestClassifyRequest, request: Request):
    """AI-classify raw content and suggest placement in the repo."""
    root = _resolve_repo_root(payload.repo_path, _github_token_from_request(request))
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    if not payload.content.strip():
        raise HTTPException(status_code=422, detail="No content provided")
    result = await classify_and_place(str(root), payload.content)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@router.post("/ingest/upload")
async def ingest_upload(
    request: Request,
    repo_path: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a binary file (PDF/DOCX/PPTX/XLSX/MD/TXT), extract to markdown,
    and AI-classify it for placement in the engagement repo.

    Returns the same shape as `/ingest/classify` plus an `extracted_chars`
    field. The caller still needs to POST to `/ingest/write` to persist.
    """
    root = _resolve_repo_root(repo_path, _github_token_from_request(request))
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")

    filename = file.filename or "upload"
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty file")
    # Guard against accidental huge uploads (25 MiB)
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 25 MiB limit")

    try:
        markdown = extract_to_markdown(filename, data)
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    classification = await classify_and_place(str(root), markdown)
    if "error" in classification:
        raise HTTPException(status_code=502, detail=classification["error"])
    return {
        **classification,
        "source_filename": filename,
        "extracted_chars": len(markdown),
        "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
    }


@router.post("/ingest/write")
async def ingest_write(request: IngestWriteRequest):
    """Write AI-classified content to the repo filesystem."""
    base = Path(request.content_dir)
    if not base.is_dir():
        raise HTTPException(status_code=400, detail="Content directory not found")
    if not request.filename.strip():
        raise HTTPException(status_code=422, detail="No filename provided")
    result = write_classified_content(
        content_dir=request.content_dir,
        directory=request.directory,
        filename=request.filename,
        content=request.content,
        action=request.action,
        append_target=request.append_target,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/references/rebuild")
async def references_rebuild(payload: RepoPathRequest, request: Request):
    """Force a rebuild of `references.md` for an engagement repo's content dir."""
    root = _resolve_repo_root(payload.path, _github_token_from_request(request))
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    content_dir = _find_content_dir(root)
    if not content_dir:
        raise HTTPException(status_code=422, detail="No content directory found")
    result = regenerate_references(content_dir)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/source/delete")
async def delete_source(payload: SourceDeleteRequest):
    """Delete a connected source and optionally purge cached source data."""
    storage = get_storage_provider()
    discovery = await storage.get("discoveries", payload.discovery_id)
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery not found")

    source_value = str(payload.source_value or "").strip()
    source_type = str(payload.source_type or "").strip() or "local_folder"
    if not source_value:
        raise HTTPException(status_code=422, detail="Source value is required")

    sources = list(discovery.get("engagement_sources") or [])
    next_sources = [
        s
        for s in sources
        if not (
            str((s or {}).get("type", "")).strip() == source_type
            and str((s or {}).get("value", "")).strip() == source_value
        )
    ]

    paths = [
        str(p).strip()
        for p in (discovery.get("engagement_repo_paths") or [])
        if str(p).strip()
    ]
    next_paths = [p for p in paths if p != source_value]
    legacy_path = str(discovery.get("engagement_repo_path", "")).strip()
    next_legacy = next_paths[0] if next_paths else ""
    if legacy_path and legacy_path != source_value and legacy_path not in next_paths:
        next_legacy = legacy_path

    purged = False
    if payload.purge_cached_data and source_type == "repository":
        normalized = normalize_github_repo_source(source_value)
        if is_github_repo_url(normalized):
            purged = delete_github_repo_source_cache(normalized)

    updated = await storage.update(
        "discoveries",
        payload.discovery_id,
        {
            "engagement_sources": next_sources,
            "engagement_repo_paths": next_paths,
            "engagement_repo_path": next_legacy,
        },
    )

    return {
        "discovery_id": payload.discovery_id,
        "removed": {
            "type": source_type,
            "value": source_value,
        },
        "remaining_sources": len(next_sources),
        "remaining_paths": next_paths,
        "purged_cached_data": purged,
        "updated_discovery": updated,
    }


_EXPORT_TARGETS: list[tuple[str, str, str, Callable[[dict, str, str], str]]] = [
    ("problem_statements", "core-problem-statement", "v", render_problem_statement),
    ("use_cases", "core-use-case", "v", render_use_case),
    ("solution_blueprints", "core-solution-blueprint", "v", render_blueprint),
    ("company_profiles", "core-company-profile", "n", render_company_profile),
    ("empathy_maps", "core-empathy-map", "n", render_empathy_map),
    ("hmw_boards", "core-hmw-board", "n", render_hmw_board),
]


async def _items_for_discovery(storage, collection: str, discovery_id: str) -> list[dict]:
    items = await storage.list(collection, {"discoveryId": discovery_id})
    if not items:
        items = await storage.list(collection, {"discovery_id": discovery_id})
    return items


def _connected_repo_paths(disc: dict) -> list[str]:
    paths: list[str] = []
    for source in disc.get("engagement_sources") or []:
        value = str((source or {}).get("value", "")).strip()
        if value and value not in paths:
            paths.append(value)
    for p in disc.get("engagement_repo_paths") or []:
        value = str(p).strip()
        if value and value not in paths:
            paths.append(value)
    legacy = str(disc.get("engagement_repo_path", "")).strip()
    if legacy and legacy not in paths:
        paths.append(legacy)
    return paths


@router.post("/export")
async def export_to_repo(payload: ExportRequest, request: Request):
    """Export approved CORE artifacts as markdown into the engagement repo.

    Writes problem statements, use cases, solution blueprints, company
    profiles, empathy maps, and HMW boards into a `decisions/` directory.
    Artifacts whose latest review status is `pending`, `changes_requested`,
    or `rejected` are skipped and reported under `skipped`.
    """
    storage = get_storage_provider()
    root = _resolve_repo_root(payload.repo_path, _github_token_from_request(request))
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Engagement repo not found")

    disc = await storage.get("discoveries", payload.discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    if payload.project_dir:
        project_path = root / payload.project_dir
    else:
        content_dir = _find_content_dir(root)
        if not content_dir:
            raise HTTPException(
                status_code=422,
                detail="No content directory found in engagement repo",
            )
        has_root_content = any(content_dir.glob("*.md"))
        if has_root_content:
            project_path = content_dir
        else:
            projects = [d for d in sorted(content_dir.iterdir()) if d.is_dir() and any(d.glob("*.md"))]
            project_path = projects[0] if projects else content_dir

    if not project_path.is_dir():
        raise HTTPException(status_code=400, detail="Project directory not found")

    decisions_dir = project_path / "decisions"
    try:
        decisions_dir.mkdir(exist_ok=True)
    except OSError as exc:
        raise HTTPException(
            status_code=400,
            detail="Engagement repo is not writable; mount the project source read-write before exporting.",
        ) from exc

    exported: list[str] = []
    skipped: list[dict] = []
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    discovery_name = str(disc.get("name") or payload.discovery_id)

    for collection, prefix, suffix_kind, renderer in _EXPORT_TARGETS:
        items = await _items_for_discovery(storage, collection, payload.discovery_id)
        for index, item in enumerate(items, start=1):
            item_id = str(item.get("id", ""))
            status = await latest_status(collection, item_id) if item_id else ""
            if status in ("pending", "changes_requested", "rejected"):
                skipped.append({"collection": collection, "id": item_id, "status": status})
                continue
            suffix = item.get("version", index) if suffix_kind == "v" else index
            filename = f"{prefix}-{suffix_kind}{suffix}.md"
            filepath = decisions_dir / filename
            try:
                filepath.write_text(renderer(item, discovery_name, today), encoding="utf-8")
            except OSError as exc:
                raise HTTPException(
                    status_code=400,
                    detail="Engagement repo is not writable; mount the project source read-write before exporting.",
                ) from exc
            exported.append(str(filepath.relative_to(root)))

    return {
        "exported": exported,
        "skipped": skipped,
        "count": len(exported),
        "target_dir": str(decisions_dir.relative_to(root)),
    }


@router.post("/publish")
async def publish_to_repos(payload: PublishRequest, request: Request):
    """Publish approved artifacts into one or more connected repos.

    - `dry_run=True`: returns a publish plan only (no writes)
    - `dry_run=False`: executes writes using AI placement when enabled
    """
    storage = get_storage_provider()
    disc = await storage.get("discoveries", payload.discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    repo_paths = payload.repo_paths or _connected_repo_paths(disc)
    if not repo_paths:
        raise HTTPException(status_code=422, detail="No connected repo paths configured")

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    discovery_name = str(disc.get("name") or payload.discovery_id)

    published: list[dict] = []
    skipped: list[dict] = []
    errors: list[dict] = []

    for repo_path in repo_paths:
        root = _resolve_repo_root(repo_path, _github_token_from_request(request))
        if not root.is_dir():
            errors.append({"repo_path": repo_path, "error": "Repository path not found"})
            continue

        repo_scan = await asyncio.to_thread(scan_engagement_repo, str(root))
        content_dir = repo_scan.get("content_dir")
        if not content_dir:
            errors.append(
                {
                    "repo_path": repo_path,
                    "error": "No content directory found in repository",
                }
            )
            continue

        for collection, prefix, suffix_kind, renderer in _EXPORT_TARGETS:
            items = await _items_for_discovery(storage, collection, payload.discovery_id)
            for index, item in enumerate(items, start=1):
                item_id = str(item.get("id", ""))
                status = await latest_status(collection, item_id) if item_id else ""
                if status in ("pending", "changes_requested", "rejected"):
                    skipped.append(
                        {
                            "repo_path": repo_path,
                            "collection": collection,
                            "id": item_id,
                            "status": status,
                        }
                    )
                    continue

                suffix = item.get("version", index) if suffix_kind == "v" else index
                fallback_filename = f"{prefix}-{suffix_kind}{suffix}.md"
                markdown = renderer(item, discovery_name, today)

                placement = {
                    "directory": "decisions",
                    "filename": fallback_filename,
                    "action": "create",
                    "append_target": "",
                }
                placement_confidence = "fallback"

                if payload.use_ai_placement:
                    classification = await classify_and_place(str(root), markdown)
                    if "error" not in classification:
                        candidate = classification.get("placement") or {}
                        placement = {
                            "directory": str(candidate.get("directory") or placement["directory"]),
                            "filename": str(candidate.get("filename") or placement["filename"]),
                            "action": str(candidate.get("action") or placement["action"]),
                            "append_target": str(
                                candidate.get("append_target") or placement["append_target"]
                            ),
                        }
                        placement_confidence = str(
                            (classification.get("classification") or {}).get("confidence") or "medium"
                        )

                if not placement["filename"].strip():
                    placement["filename"] = fallback_filename

                row = {
                    "repo_path": repo_path,
                    "collection": collection,
                    "id": item_id,
                    "filename": placement["filename"],
                    "directory": placement["directory"],
                    "action": placement["action"],
                    "append_target": placement["append_target"],
                    "placement_confidence": placement_confidence,
                    "dry_run": payload.dry_run,
                }

                if not payload.dry_run:
                    write_result = write_classified_content(
                        content_dir=content_dir,
                        directory=placement["directory"],
                        filename=placement["filename"],
                        content=markdown,
                        action=placement["action"],
                        append_target=placement["append_target"],
                    )
                    if "error" in write_result:
                        errors.append(
                            {
                                "repo_path": repo_path,
                                "collection": collection,
                                "id": item_id,
                                "error": write_result["error"],
                            }
                        )
                        continue
                    row["written_path"] = write_result.get("path", "")

                published.append(row)

    return {
        "discovery_id": payload.discovery_id,
        "dry_run": payload.dry_run,
        "use_ai_placement": payload.use_ai_placement,
        "repo_paths": repo_paths,
        "count": len(published),
        "published": published,
        "skipped": skipped,
        "errors": errors,
    }
