"""HITL review-gate helpers.

A small helper module so callers don't have to know the storage shape of
reviews. `auto_request_review` opens a pending Review tied to an artifact.
`is_blocked_by_review` returns True when the artifact has an open or
rejected review (so callers can refuse to act on it).
"""

from __future__ import annotations

import logging

from app.providers.storage import get_storage_provider
from app.utils.audit import current_user, stamp_create, user_label

logger = logging.getLogger(__name__)

REVIEW_COLLECTION = "reviews"
_OPEN_STATUSES = {"pending", "changes_requested"}
_BLOCKING_STATUSES = {"pending", "changes_requested", "rejected"}


async def auto_request_review(
    *,
    artifact_collection: str,
    artifact_id: str,
    artifact_title: str = "",
    discovery_id: str = "",
) -> dict | None:
    """Open a pending Review for an artifact if one isn't already open.

    Returns the created (or pre-existing open) review row, or None on error.
    Errors are swallowed and logged so a failed review write never breaks
    the artifact write itself.
    """
    storage = get_storage_provider()
    try:
        existing = await storage.list(
            REVIEW_COLLECTION,
            {
                "artifact_collection": artifact_collection,
                "artifact_id": artifact_id,
            },
        )
        for row in existing:
            if (row.get("status") or "") in _OPEN_STATUSES:
                return row
        requested_by = user_label(current_user.get())
        review = stamp_create(
            {
                "artifact_collection": artifact_collection,
                "artifact_id": artifact_id,
                "artifact_title": artifact_title,
                "discovery_id": discovery_id,
                "status": "pending",
                "requested_by": requested_by,
                "reviewer": "",
                "comment": "",
            }
        )
        return await storage.create(REVIEW_COLLECTION, review)
    except Exception:  # noqa: BLE001
        logger.exception("auto_request_review failed for %s/%s", artifact_collection, artifact_id)
        return None


async def is_blocked_by_review(artifact_collection: str, artifact_id: str) -> bool:
    """Return True when the artifact has any open or rejected review."""
    storage = get_storage_provider()
    try:
        rows = await storage.list(
            REVIEW_COLLECTION,
            {
                "artifact_collection": artifact_collection,
                "artifact_id": artifact_id,
            },
        )
    except Exception:  # noqa: BLE001
        logger.exception("is_blocked_by_review failed")
        return False
    return any((row.get("status") or "") in _BLOCKING_STATUSES for row in rows)


async def latest_status(artifact_collection: str, artifact_id: str) -> str:
    """Return the most-recent review status for an artifact, or '' if none."""
    storage = get_storage_provider()
    try:
        rows = await storage.list(
            REVIEW_COLLECTION,
            {
                "artifact_collection": artifact_collection,
                "artifact_id": artifact_id,
            },
        )
    except Exception:  # noqa: BLE001
        return ""
    if not rows:
        return ""
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows[0].get("status", "") or ""
