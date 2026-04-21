"""Append-only audit log.

A separate collection (`audit`) recording who did what to which artifact and
when. The log is best-effort — failures here never block the underlying
write — and mostly meant for an FDE to answer "who approved this last
Tuesday" without grepping logs.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from app.providers.storage import get_storage_provider
from app.utils.audit import current_user, user_label

logger = logging.getLogger(__name__)

AUDIT_COLLECTION = "audit"


def _hash(value: Any) -> str:
    if value is None:
        return ""
    try:
        payload = json.dumps(value, default=str, sort_keys=True).encode("utf-8")
    except Exception:  # noqa: BLE001
        payload = repr(value).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


async def audit(
    action: str,
    *,
    collection: str,
    item_id: str = "",
    summary: str = "",
    before: Any = None,
    after: Any = None,
    extra: dict | None = None,
) -> None:
    """Record a single audit event. Errors are swallowed and logged."""
    storage = get_storage_provider()
    actor = user_label(current_user.get())
    record = {
        "id": str(uuid.uuid4()),
        "ts": datetime.now(UTC).isoformat(),
        "actor": actor,
        "action": action,
        "collection": collection,
        "item_id": item_id,
        "summary": summary[:200],
        "before_hash": _hash(before),
        "after_hash": _hash(after),
    }
    if extra:
        record["extra"] = extra
    try:
        await storage.create(AUDIT_COLLECTION, record)
    except Exception:  # noqa: BLE001
        logger.exception("audit write failed for %s/%s", collection, item_id)
