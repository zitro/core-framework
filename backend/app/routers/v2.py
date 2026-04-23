"""v2.0 endpoints: storyboard image generation + vertex repo tree viewer.

Lives in its own router so the existing ``synthesis.py`` (already large)
doesn't grow further. Mounted under ``/api/v2``.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.image import get_image_provider
from app.providers.storage import get_storage_provider
from app.synthesis.generator import ARTIFACTS_COLLECTION
from app.synthesis.models import Artifact
from app.utils.project_paths import resolve_project_repo_path

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

PROJECTS_COLLECTION = "engagements"
_MAX_FILE_BYTES = 1 * 1024 * 1024  # 1 MiB cap on viewer file reads


# ── shared loaders ───────────────────────────────────────────────────────


async def _load_project(project_id: str) -> dict:
    storage = get_storage_provider()
    project = await storage.get(PROJECTS_COLLECTION, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _load_artifact(project_id: str, artifact_id: str) -> tuple[dict, Artifact]:
    storage = get_storage_provider()
    raw = await storage.get(ARTIFACTS_COLLECTION, artifact_id)
    if not raw:
        raise HTTPException(status_code=404, detail="Artifact not found")
    if str(raw.get("project_id") or raw.get("projectId") or "") != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return raw, Artifact(**raw)


# ── storyboard image generation ──────────────────────────────────────────


class GenerateImagesResponse(BaseModel):
    artifact_id: str
    provider: str
    generated: int
    skipped: int
    artifact: dict


@router.post("/{project_id}/artifacts/{artifact_id}/images")
async def generate_storyboard_images(project_id: str, artifact_id: str) -> dict:
    """Generate one image per storyboard frame whose ``image_url`` is empty.

    Idempotent: frames that already have an ``image_url`` are skipped, so the
    UI can re-run safely after partial failures or after editing a single
    prompt.
    """
    raw, artifact = await _load_artifact(project_id, artifact_id)
    if artifact.type_id != "storyboard":
        raise HTTPException(
            status_code=422,
            detail="Image generation is only supported for storyboard artifacts",
        )
    frames = list(artifact.body.get("frames") or [])
    if not frames:
        raise HTTPException(status_code=422, detail="Storyboard has no frames")

    provider = get_image_provider()
    generated = 0
    skipped = 0
    new_frames: list[dict] = []
    for frame in frames:
        if not isinstance(frame, dict):
            new_frames.append(frame)
            skipped += 1
            continue
        if frame.get("image_url"):
            new_frames.append(frame)
            skipped += 1
            continue
        prompt = (frame.get("image_prompt") or frame.get("description") or "").strip()
        if not prompt:
            new_frames.append(frame)
            skipped += 1
            continue
        try:
            image = await provider.generate(prompt)
        except Exception as exc:  # noqa: BLE001
            logger.exception("v2.images: generate failed for artifact=%s", artifact_id)
            raise HTTPException(status_code=502, detail=f"Image provider error: {exc}") from exc
        updated = dict(frame)
        updated["image_url"] = image.url
        updated["image_alt"] = image.alt_text
        updated["image_provider"] = image.provider
        new_frames.append(updated)
        if image.url:
            generated += 1
        else:
            skipped += 1

    raw["body"] = {**(raw.get("body") or {}), "frames": new_frames}
    raw["updated_at"] = artifact.updated_at.isoformat()
    storage = get_storage_provider()
    await storage.update(ARTIFACTS_COLLECTION, artifact_id, raw)

    return GenerateImagesResponse(
        artifact_id=artifact_id,
        provider=provider.name,
        generated=generated,
        skipped=skipped,
        artifact=raw,
    ).model_dump(mode="json")


# ── vertex repo tree viewer ──────────────────────────────────────────────


class VertexTreeNode(BaseModel):
    name: str
    path: str  # repo-relative posix path
    kind: str  # "dir" | "file"
    children: list[VertexTreeNode] = Field(default_factory=list)


VertexTreeNode.model_rebuild()


class VertexTreeResponse(BaseModel):
    project_id: str
    repo_path: str
    root: VertexTreeNode | None
    available: bool
    reason: str = ""


def _resolve_repo(project: dict) -> Path | None:
    repo_path = (project.get("repo_path") or "").strip()
    if not repo_path:
        return None
    try:
        root = resolve_project_repo_path(repo_path)
    except Exception:
        logger.exception("v2.vertex: failed to resolve %s", repo_path)
        return None
    if not root.exists() or not root.is_dir():
        return None
    return root


def _safe_join(root: Path, rel: str) -> Path | None:
    """Join ``rel`` to ``root`` and refuse anything that escapes the root."""
    rel = (rel or "").strip().lstrip("/")
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def _walk(root: Path, current: Path) -> VertexTreeNode:
    rel = current.relative_to(root).as_posix() if current != root else ""
    node = VertexTreeNode(
        name=current.name or root.name,
        path=rel,
        kind="dir" if current.is_dir() else "file",
        children=[],
    )
    if not current.is_dir():
        return node
    entries = []
    try:
        for child in current.iterdir():
            if child.name.startswith(".") or child.name == "__pycache__":
                continue
            entries.append(child)
    except PermissionError:
        return node
    entries.sort(key=lambda p: (p.is_file(), p.name.lower()))
    for child in entries:
        if child.is_dir():
            node.children.append(_walk(root, child))
        elif child.suffix.lower() in {".md", ".markdown", ".json", ".yaml", ".yml", ".txt"}:
            node.children.append(
                VertexTreeNode(
                    name=child.name,
                    path=child.relative_to(root).as_posix(),
                    kind="file",
                )
            )
    return node


@router.get("/{project_id}/vertex/tree")
async def vertex_tree(project_id: str) -> dict:
    project = await _load_project(project_id)
    repo_path = (project.get("repo_path") or "").strip()
    root = _resolve_repo(project)
    if not root:
        return VertexTreeResponse(
            project_id=project_id,
            repo_path=repo_path,
            root=None,
            available=False,
            reason="Project has no resolvable vertex repo_path on disk",
        ).model_dump(mode="json")
    tree = _walk(root, root)
    return VertexTreeResponse(
        project_id=project_id,
        repo_path=str(root),
        root=tree,
        available=True,
    ).model_dump(mode="json")


class VertexFileResponse(BaseModel):
    project_id: str
    path: str
    content: str
    truncated: bool = False
    size: int = 0


@router.get("/{project_id}/vertex/file")
async def vertex_file(project_id: str, path: str = Query(..., min_length=1)) -> dict:
    project = await _load_project(project_id)
    root = _resolve_repo(project)
    if not root:
        raise HTTPException(status_code=404, detail="Vertex repo not available")
    target = _safe_join(root, path)
    if target is None or not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found in vertex repo")
    size = target.stat().st_size
    truncated = size > _MAX_FILE_BYTES
    raw = target.read_bytes()[:_MAX_FILE_BYTES]
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("utf-8", errors="replace")
    return VertexFileResponse(
        project_id=project_id,
        path=path,
        content=content,
        truncated=truncated,
        size=size,
    ).model_dump(mode="json")
