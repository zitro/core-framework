"""Scan, content preview, references rebuild, and source delete endpoints."""

from __future__ import annotations

import asyncio

from fastapi import HTTPException, Request

from app.providers.storage import get_storage_provider
from app.routers.engagement._router import (
    RepoPathRequest,
    SourceDeleteRequest,
    github_token_from_request,
    resolve_repo_root,
    router,
)
from app.utils.engagement import (
    _find_content_dir,
    read_engagement_content_structured,
    scan_engagement_repo,
)
from app.utils.references import regenerate_references
from app.utils.repo_source import (
    delete_github_repo_source_cache,
    is_github_repo_url,
    normalize_github_repo_source,
)


@router.post("/scan")
async def scan_repo(payload: RepoPathRequest, request: Request):
    """Scan an engagement repo directory and return its structure.

    ``path`` may be absolute or relative to ``settings.projects_root``.
    """
    root = resolve_repo_root(
        payload.path,
        github_token_from_request(request),
        refresh=payload.refresh,
    )
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    return await asyncio.to_thread(scan_engagement_repo, str(root))


@router.post("/content")
async def get_content(payload: RepoPathRequest, request: Request):
    """Return full parsed content from an engagement repo for frontend rendering."""
    root = resolve_repo_root(
        payload.path,
        github_token_from_request(request),
        refresh=payload.refresh,
    )
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Directory not found")
    result = await asyncio.to_thread(read_engagement_content_structured, str(root))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/references/rebuild")
async def references_rebuild(payload: RepoPathRequest, request: Request):
    """Force a rebuild of `references.md` for an engagement repo's content dir."""
    root = resolve_repo_root(payload.path, github_token_from_request(request))
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
        str(p).strip() for p in (discovery.get("engagement_repo_paths") or []) if str(p).strip()
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
        "removed": {"type": source_type, "value": source_value},
        "remaining_sources": len(next_sources),
        "remaining_paths": next_paths,
        "purged_cached_data": purged,
        "updated_discovery": updated,
    }
