"""Engagement repo router — scan, preview, ingest, and export."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.providers.storage import get_storage_provider
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
from app.utils.references import regenerate_references
from app.utils.review_gate import latest_status

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])


class RepoPathRequest(BaseModel):
    path: str


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


@router.post("/scan")
async def scan_repo(request: RepoPathRequest):
    """Scan an engagement repo directory and return its structure."""
    root = Path(request.path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    return scan_engagement_repo(request.path)


@router.post("/content")
async def get_content(request: RepoPathRequest):
    """Return full parsed content from an engagement repo for frontend rendering."""
    root = Path(request.path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    result = read_engagement_content_structured(request.path)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/ingest/classify")
async def ingest_classify(request: IngestClassifyRequest):
    """AI-classify raw content and suggest placement in the repo."""
    root = Path(request.repo_path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    if not request.content.strip():
        raise HTTPException(status_code=422, detail="No content provided")
    result = await classify_and_place(request.repo_path, request.content)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@router.post("/ingest/upload")
async def ingest_upload(
    repo_path: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a binary file (PDF/DOCX/PPTX/XLSX/MD/TXT), extract to markdown,
    and AI-classify it for placement in the engagement repo.

    Returns the same shape as `/ingest/classify` plus an `extracted_chars`
    field. The caller still needs to POST to `/ingest/write` to persist.
    """
    root = Path(repo_path)
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

    classification = await classify_and_place(repo_path, markdown)
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
async def references_rebuild(request: RepoPathRequest):
    """Force a rebuild of `references.md` for an engagement repo's content dir."""
    root = Path(request.path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    content_dir = _find_content_dir(root)
    if not content_dir:
        raise HTTPException(status_code=422, detail="No content directory found")
    result = regenerate_references(content_dir)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


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


@router.post("/export")
async def export_to_repo(request: ExportRequest):
    """Export approved CORE artifacts as markdown into the engagement repo.

    Writes problem statements, use cases, solution blueprints, company
    profiles, empathy maps, and HMW boards into a `decisions/` directory.
    Artifacts whose latest review status is `pending`, `changes_requested`,
    or `rejected` are skipped and reported under `skipped`.
    """
    storage = get_storage_provider()
    root = Path(request.repo_path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Engagement repo not found")

    disc = await storage.get("discoveries", request.discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")

    if request.project_dir:
        project_path = root / request.project_dir
    else:
        content_dir = _find_content_dir(root)
        if not content_dir:
            raise HTTPException(
                status_code=422,
                detail="No content directory found in engagement repo",
            )
        projects = [d for d in sorted(content_dir.iterdir()) if d.is_dir() and any(d.glob("*.md"))]
        project_path = projects[0] if projects else content_dir

    if not project_path.is_dir():
        raise HTTPException(status_code=400, detail="Project directory not found")

    decisions_dir = project_path / "decisions"
    decisions_dir.mkdir(exist_ok=True)

    exported: list[str] = []
    skipped: list[dict] = []
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    discovery_name = disc.get("name", "CORE Discovery")

    for collection, prefix, suffix_kind, renderer in _EXPORT_TARGETS:
        items = await _items_for_discovery(storage, collection, request.discovery_id)
        for index, item in enumerate(items, start=1):
            item_id = str(item.get("id", ""))
            status = await latest_status(collection, item_id) if item_id else ""
            if status in ("pending", "changes_requested", "rejected"):
                skipped.append({"collection": collection, "id": item_id, "status": status})
                continue
            suffix = item.get("version", index) if suffix_kind == "v" else index
            filename = f"{prefix}-{suffix_kind}{suffix}.md"
            filepath = decisions_dir / filename
            filepath.write_text(renderer(item, discovery_name, today), encoding="utf-8")
            exported.append(str(filepath.relative_to(root)))

    return {
        "exported": exported,
        "skipped": skipped,
        "count": len(exported),
        "target_dir": str(decisions_dir.relative_to(root)),
    }
