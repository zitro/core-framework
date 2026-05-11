"""v2 endpoints — storyboard image generation.

Lives in its own router so the existing synthesis package doesn't grow
further. Mounted under ``/api/v2``.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.providers.image import get_image_provider
from app.providers.storage import get_storage_provider
from app.synthesis.generator import ARTIFACTS_COLLECTION
from app.synthesis.models import Artifact

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])


async def _load_artifact(project_id: str, artifact_id: str) -> tuple[dict, Artifact]:
    storage = get_storage_provider()
    raw = await storage.get(ARTIFACTS_COLLECTION, artifact_id)
    if not raw:
        raise HTTPException(status_code=404, detail="Artifact not found")
    if str(raw.get("project_id") or raw.get("projectId") or "") != project_id:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return raw, Artifact(**raw)


class GenerateImagesResponse(BaseModel):
    artifact_id: str
    provider: str
    generated: int
    skipped: int
    artifact: dict


@router.post("/{project_id}/artifacts/{artifact_id}/images")
async def generate_storyboard_images(project_id: str, artifact_id: str) -> dict:
    """Generate one image per storyboard frame whose ``image_url`` is empty.

    Idempotent: frames that already have an ``image_url`` are skipped, so
    the UI can re-run safely after partial failures or prompt edits.
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
        except Exception as exc:
            logger.exception("v2.images: generate failed for artifact=%s", artifact_id)
            raise HTTPException(
                status_code=502, detail=f"Image provider error: {exc}"
            ) from exc
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
