"""Project-notes CRUD for the user_notes source adapter.

  POST   /{project_id}/notes
  GET    /{project_id}/notes
  DELETE /{project_id}/notes/{note_id}

Notes are surfaced in the corpus by the UserNotesSourceAdapter on the
next build_corpus call. Master's note POST also auto-regenerated
target artifacts; we drop that here to keep notes-add LLM-free. The
user clicks the existing regenerate endpoint explicitly if they want
to see the note ripple through.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from pydantic import BaseModel, Field

from app.providers.storage import get_storage_provider
from app.routers.synthesis._helpers import load_project
from app.routers.synthesis._router import router
from app.utils.audit import stamp_create

PROJECT_NOTES_COLLECTION = "project_notes"


class AddNotePayload(BaseModel):
    text: str = Field(..., min_length=3, max_length=4000)
    target_type_id: str | None = None


@router.post("/{project_id}/notes")
async def add_project_note(project_id: str, payload: AddNotePayload) -> dict:
    """Persist a user-authored note. Surfaces in the next build_corpus
    pass via UserNotesSourceAdapter; doesn't auto-regenerate artifacts."""
    await load_project(project_id)
    storage = get_storage_provider()
    note_id = f"note_{uuid.uuid4().hex[:12]}"
    record = {
        "id": note_id,
        "project_id": project_id,
        "text": payload.text.strip(),
        "target_type_id": (payload.target_type_id or "").strip() or None,
        # Stamp created_at explicitly — local storage doesn't add it and the
        # /list endpoint sorts on it. Master had the same shape.
        "created_at": datetime.now(UTC).isoformat(),
    }
    saved = await storage.create(PROJECT_NOTES_COLLECTION, stamp_create(record))
    return {"note": saved}


@router.get("/{project_id}/notes")
async def list_project_notes(project_id: str) -> dict:
    """List notes for a project, newest first."""
    await load_project(project_id)
    storage = get_storage_provider()
    items = await storage.list(PROJECT_NOTES_COLLECTION)
    notes = [n for n in items if str(n.get("project_id") or "") == project_id]
    notes.sort(key=lambda n: str(n.get("created_at") or ""), reverse=True)
    return {"notes": notes}


@router.delete("/{project_id}/notes/{note_id}")
async def delete_project_note(project_id: str, note_id: str) -> dict:
    """Remove a note. 404 if the id doesn't exist."""
    await load_project(project_id)
    storage = get_storage_provider()
    deleted = await storage.delete(PROJECT_NOTES_COLLECTION, note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"deleted": True}
