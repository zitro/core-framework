"""POST /{project_id}/export/{fmt} — docx and pptx renderers."""

from __future__ import annotations

import logging
import re

from fastapi import HTTPException
from fastapi.responses import Response

from app.routers.synthesis._helpers import load_project, project_artifacts
from app.routers.synthesis._router import router
from app.synthesis.exporters import export_docx, export_pptx

logger = logging.getLogger(__name__)

_FORMATS: dict[str, tuple[str, str]] = {
    "docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
    "pptx": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
    ),
}


def _slug(value: str, fallback: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return base or fallback


@router.post("/{project_id}/export/{fmt}")
async def export_project(project_id: str, fmt: str) -> Response:
    """Render every saved artifact for a project as a single .docx or .pptx."""
    if fmt not in _FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}")

    project = await load_project(project_id)
    artifacts = await project_artifacts(project_id)

    try:
        payload = (
            export_docx(project, artifacts) if fmt == "docx" else export_pptx(project, artifacts)
        )
    except Exception as exc:
        logger.exception("export %s failed for project %s", fmt, project_id)
        raise HTTPException(status_code=500, detail=f"Export failed: {exc}") from exc

    media_type, ext = _FORMATS[fmt]
    name = _slug(str(project.get("name") or project.get("slug") or project_id), project_id)
    filename = f"{name}-synthesis.{ext}"
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
