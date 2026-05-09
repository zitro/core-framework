from pathlib import Path
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.config import settings
from app.dependencies import get_current_user
from app.models.core import Evidence, EvidenceUpdate
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create, stamp_update
from app.utils.file_extract import ExtractionError, UnsupportedFileTypeError, extract_to_markdown

router = APIRouter(dependencies=[Depends(get_current_user)])
COLLECTION = "evidence"

_AUDIO_VIDEO_EXTENSIONS = {
    ".aac",
    ".aiff",
    ".flac",
    ".m4a",
    ".mkv",
    ".mov",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpg",
    ".ogg",
    ".wav",
    ".webm",
    ".wma",
}


def _format_upload_metadata(filename: str, content_type: str, size: int) -> str:
    parts = [f"Attached file: {filename}", f"Size: {size} bytes"]
    if content_type:
        parts.append(f"Content type: {content_type}")
    return "\n".join(parts)


async def _extract_uploaded_content(filename: str, content_type: str, data: bytes) -> tuple[str, list[str]]:
    tags: list[str] = []
    try:
        extracted = extract_to_markdown(filename, data)
        tags.append("extracted-text")
        return extracted, tags
    except UnsupportedFileTypeError:
        pass
    except ExtractionError as exc:
        tags.append("extraction-failed")
        return f"{_format_upload_metadata(filename, content_type, len(data))}\nExtraction failed: {exc}", tags

    ext = Path(filename).suffix.lower()
    if ext in _AUDIO_VIDEO_EXTENSIONS or content_type.startswith(("audio/", "video/")):
        if settings.speech_provider != "none":
            tmp_path = ""
            try:
                from app.providers.speech import get_speech_provider

                suffix = ext or ".audio"
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    tmp.write(data)
                    tmp_path = tmp.name
                transcript = await get_speech_provider().transcribe_file(tmp_path)
                if transcript.strip():
                    tags.extend(["media", "transcribed"])
                    return transcript.strip(), tags
            except Exception as exc:
                tags.extend(["media", "transcription-failed"])
                return (
                    f"{_format_upload_metadata(filename, content_type, len(data))}\n"
                    f"Transcription failed; the recording was still saved as evidence.",
                    tags,
                )
            finally:
                if tmp_path:
                    Path(tmp_path).unlink(missing_ok=True)
        tags.append("media")

    tags.append("attachment")
    return _format_upload_metadata(filename, content_type, len(data)), tags


@router.post("/", response_model=Evidence, status_code=201)
async def create_evidence(evidence: Evidence):
    storage = get_storage_provider()
    item = await storage.create(COLLECTION, stamp_create(evidence.model_dump(mode="json")))
    return Evidence(**item)


@router.post("/upload", response_model=Evidence, status_code=201)
async def upload_evidence(
    discovery_id: str = Form(...),
    phase: str = Form("capture"),
    evidence_type: str = Form("general"),
    source: str = Form(""),
    note: str = Form(""),
    tags: str = Form(""),
    file: UploadFile = File(...),
):
    """Create evidence from an uploaded file.

    Supported office/text files are extracted into markdown so downstream AI
    context can use their content. Unsupported files are still saved as evidence
    metadata, and media files are transcribed when a speech provider is enabled.
    """
    filename = file.filename or "uploaded-file"
    content_type = file.content_type or ""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")

    extracted_content, inferred_tags = await _extract_uploaded_content(filename, content_type, data)
    user_tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
    source_value = source.strip() or filename
    note_text = note.strip()
    content = (
        f"{note_text}\n\n---\n\n{extracted_content}" if note_text else extracted_content
    )

    evidence = Evidence(
        discovery_id=discovery_id,
        phase=phase,
        content=content,
        source=source_value,
        evidence_type=evidence_type,
        tags=["evidence", "file", *inferred_tags, *user_tags],
    )
    storage = get_storage_provider()
    item = await storage.create(COLLECTION, stamp_create(evidence.model_dump(mode="json")))
    return Evidence(**item)


@router.get("/{discovery_id}", response_model=list[Evidence])
async def list_evidence(discovery_id: str, phase: str | None = None):
    storage = get_storage_provider()
    filters = {"discovery_id": discovery_id}
    if phase:
        filters["phase"] = phase
    items = await storage.list(COLLECTION, filters)
    return [Evidence(**item) for item in items]


@router.get("/", response_model=list[Evidence])
async def list_evidence_scoped(
    engagement_id: str | None = Query(default=None),
    phase: str | None = Query(default=None),
):
    """List evidence across all discoveries, optionally scoped to an engagement."""
    storage = get_storage_provider()
    filters = {"phase": phase} if phase else None
    items = await storage.list(COLLECTION, filters)
    if engagement_id:
        engagement = await storage.get("engagements", engagement_id)
        if not engagement:
            raise HTTPException(status_code=404, detail="Engagement not found")
        allowed = set(engagement.get("discovery_ids") or [])
        items = [i for i in items if i.get("discovery_id") in allowed]
    return [Evidence(**item) for item in items]


@router.patch("/{evidence_id}", response_model=Evidence)
async def update_evidence(evidence_id: str, updates: EvidenceUpdate):
    storage = get_storage_provider()
    update_data = updates.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No valid fields to update")
    stamp_update(update_data)
    try:
        item = await storage.update(COLLECTION, evidence_id, update_data)
    except ValueError:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return Evidence(**item)


@router.delete("/{evidence_id}")
async def delete_evidence(evidence_id: str):
    storage = get_storage_provider()
    deleted = await storage.delete(COLLECTION, evidence_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return {"deleted": True}
