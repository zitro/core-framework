"""Ingest endpoints — classify raw content, upload binaries, persist writes."""

from __future__ import annotations

from pathlib import Path

from fastapi import File, Form, HTTPException, Request, UploadFile

from app.routers.engagement._router import (
    IngestClassifyRequest,
    IngestWriteRequest,
    github_token_from_request,
    resolve_repo_root,
    router,
)
from app.utils.file_extract import (
    SUPPORTED_EXTENSIONS,
    ExtractionError,
    UnsupportedFileTypeError,
    extract_to_markdown,
)
from app.utils.ingest import classify_and_place, write_classified_content

_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024  # 25 MiB


@router.post("/ingest/classify")
async def ingest_classify(payload: IngestClassifyRequest, request: Request):
    """AI-classify raw content and suggest placement in the repo."""
    root = resolve_repo_root(payload.repo_path, github_token_from_request(request))
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
    """Upload a binary file, extract to markdown, and AI-classify for placement.

    Returns the same shape as ``/ingest/classify`` plus an ``extracted_chars``
    field. The caller still needs to POST to ``/ingest/write`` to persist.
    """
    root = resolve_repo_root(repo_path, github_token_from_request(request))
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")

    filename = file.filename or "upload"
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty file")
    if len(data) > _UPLOAD_LIMIT_BYTES:
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
