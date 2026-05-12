"""Export approved artifacts to a single repo and publish across many repos."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import UTC, datetime

from fastapi import HTTPException, Request

from app.providers.storage import get_storage_provider
from app.routers.engagement._router import (
    ExportRequest,
    PublishRequest,
    github_token_from_request,
    resolve_repo_root,
    router,
)
from app.utils.engagement import _find_content_dir, scan_engagement_repo
from app.utils.engagement_export import (
    render_blueprint,
    render_company_profile,
    render_empathy_map,
    render_hmw_board,
    render_problem_statement,
    render_use_case,
)
from app.utils.ingest import classify_and_place, write_classified_content
from app.utils.review_gate import latest_status

_EXPORT_TARGETS: list[tuple[str, str, str, Callable[[dict, str, str], str]]] = [
    ("problem_statements", "core-problem-statement", "v", render_problem_statement),
    ("use_cases", "core-use-case", "v", render_use_case),
    ("solution_blueprints", "core-solution-blueprint", "v", render_blueprint),
    ("company_profiles", "core-company-profile", "n", render_company_profile),
    ("empathy_maps", "core-empathy-map", "n", render_empathy_map),
    ("hmw_boards", "core-hmw-board", "n", render_hmw_board),
]

_SKIP_STATUSES = {"pending", "changes_requested", "rejected"}


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
    profiles, empathy maps, and HMW boards into a ``decisions/`` directory.
    Artifacts whose latest review status is ``pending``, ``changes_requested``,
    or ``rejected`` are skipped and reported under ``skipped``.
    """
    storage = get_storage_provider()
    root = resolve_repo_root(payload.repo_path, github_token_from_request(request))
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
            projects = [
                d for d in sorted(content_dir.iterdir()) if d.is_dir() and any(d.glob("*.md"))
            ]
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
            if status in _SKIP_STATUSES:
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


async def _ai_placement(
    use_ai: bool,
    root_str: str,
    markdown: str,
    fallback_filename: str,
) -> tuple[dict, str]:
    placement = {
        "directory": "decisions",
        "filename": fallback_filename,
        "action": "create",
        "append_target": "",
    }
    confidence = "fallback"

    if use_ai:
        classification = await classify_and_place(root_str, markdown)
        if "error" not in classification:
            candidate = classification.get("placement") or {}
            placement = {
                "directory": str(candidate.get("directory") or placement["directory"]),
                "filename": str(candidate.get("filename") or placement["filename"]),
                "action": str(candidate.get("action") or placement["action"]),
                "append_target": str(candidate.get("append_target") or placement["append_target"]),
            }
            confidence = str(
                (classification.get("classification") or {}).get("confidence") or "medium"
            )

    if not placement["filename"].strip():
        placement["filename"] = fallback_filename
    return placement, confidence


@router.post("/publish")
async def publish_to_repos(payload: PublishRequest, request: Request):
    """Publish approved artifacts into one or more connected repos.

    - ``dry_run=True``: returns a publish plan only (no writes)
    - ``dry_run=False``: executes writes using AI placement when enabled
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
        root = resolve_repo_root(repo_path, github_token_from_request(request))
        if not root.is_dir():
            errors.append({"repo_path": repo_path, "error": "Repository path not found"})
            continue

        repo_scan = await asyncio.to_thread(scan_engagement_repo, str(root))
        content_dir = repo_scan.get("content_dir")
        if not content_dir:
            errors.append(
                {"repo_path": repo_path, "error": "No content directory found in repository"}
            )
            continue

        for collection, prefix, suffix_kind, renderer in _EXPORT_TARGETS:
            items = await _items_for_discovery(storage, collection, payload.discovery_id)
            for index, item in enumerate(items, start=1):
                item_id = str(item.get("id", ""))
                status = await latest_status(collection, item_id) if item_id else ""
                if status in _SKIP_STATUSES:
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

                placement, placement_confidence = await _ai_placement(
                    payload.use_ai_placement, str(root), markdown, fallback_filename
                )

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
