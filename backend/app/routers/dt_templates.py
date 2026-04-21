"""Design-thinking artifact template router.

Lists shipped DT templates (empathy map, persona, journey map, HMW board,
assumption matrix), serves their raw markdown, and can drop a copy into
an engagement repo.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.utils.engagement import _find_content_dir
from app.utils.references import regenerate_references

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(get_current_user)])

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "dt"

_CATALOG: dict[str, dict[str, str]] = {
    "empathy-map": {
        "title": "Empathy Map",
        "phase": "capture",
        "filename": "empathy-map.md",
    },
    "persona": {
        "title": "Persona",
        "phase": "orient",
        "filename": "persona.md",
    },
    "journey-map": {
        "title": "Journey Map",
        "phase": "orient",
        "filename": "journey-map.md",
    },
    "hmw-board": {
        "title": "How Might We Board",
        "phase": "orient",
        "filename": "hmw-board.md",
    },
    "assumption-matrix": {
        "title": "Assumption Matrix",
        "phase": "refine",
        "filename": "assumption-matrix.md",
    },
}


class DropTemplateRequest(BaseModel):
    repo_path: str
    target_directory: str = "design-thinking"
    name_suffix: str = ""


def _load_template(template_id: str) -> str:
    if template_id not in _CATALOG:
        raise HTTPException(status_code=404, detail=f"Unknown template: {template_id}")
    path = _TEMPLATES_DIR / _CATALOG[template_id]["filename"]
    if not path.is_file():
        raise HTTPException(status_code=500, detail="Template file missing on server")
    return path.read_text(encoding="utf-8")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "untitled"


@router.get("")
async def list_templates() -> list[dict[str, str]]:
    return [{"id": tid, **meta} for tid, meta in _CATALOG.items()]


@router.get("/{template_id}")
async def get_template(template_id: str) -> dict[str, str]:
    return {
        "id": template_id,
        **_CATALOG.get(template_id, {}),
        "content": _load_template(template_id),
    }


@router.post("/{template_id}/drop")
async def drop_template(template_id: str, request: DropTemplateRequest):
    """Write a copy of the template into an engagement repo's content dir."""
    raw = _load_template(template_id)
    root = Path(request.repo_path)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail="Engagement repo not found")
    content_dir = _find_content_dir(root)
    if not content_dir:
        raise HTTPException(status_code=422, detail="No content directory found")

    target_dir = content_dir / request.target_directory
    target_dir.mkdir(parents=True, exist_ok=True)

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    suffix = f"-{_slugify(request.name_suffix)}" if request.name_suffix else ""
    filename = f"{template_id}{suffix}.md"
    target = target_dir / filename
    if target.exists():
        # don't clobber — append timestamp
        target = target_dir / f"{template_id}{suffix}-{today}.md"

    target.write_text(raw, encoding="utf-8")
    ref = regenerate_references(content_dir)
    return {
        "path": str(target.relative_to(root)),
        "full_path": str(target),
        "references_index": ref,
    }
