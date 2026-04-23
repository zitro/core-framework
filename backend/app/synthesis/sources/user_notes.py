"""User-notes source adapter (v2.2.8).

Pulls user-authored notes from the ``project_notes`` collection. Notes are
created via ``POST /api/synthesis/{project_id}/notes`` from the Refine page
(the ``+ Add`` button on each artifact card).

Each note becomes a small ``SourceDoc`` so subsequent regenerations of any
artifact can ground against it.
"""

from __future__ import annotations

import logging

from app.providers.storage import get_storage_provider
from app.synthesis.models import SourceDoc, SourceKind
from app.synthesis.sources.base import SourceAdapter

logger = logging.getLogger(__name__)


class UserNotesSourceAdapter(SourceAdapter):
    kind = SourceKind.USER_NOTE.value

    async def fetch(self, project: dict) -> list[SourceDoc]:
        project_id = str(project.get("id") or "")
        if not project_id:
            return []
        storage = get_storage_provider()
        try:
            items = await storage.list("project_notes")
        except Exception:
            logger.warning("user_notes: list failed", exc_info=True)
            return []

        notes = [n for n in items if str(n.get("project_id") or "") == project_id]
        out: list[SourceDoc] = []
        for n in notes:
            text = str(n.get("text") or "").strip()
            if not text:
                continue
            target = str(n.get("target_type_id") or "general").strip()
            note_id = str(n.get("id") or "")
            title = f"User note → {target}"
            out.append(
                SourceDoc(
                    id=f"user_note:{note_id}",
                    kind=SourceKind.USER_NOTE,
                    title=title,
                    uri="",
                    snippet=text[:400],
                    text=text,
                    last_modified=str(n.get("created_at") or ""),
                    metadata={"target_type_id": target},
                )
            )
        return out
