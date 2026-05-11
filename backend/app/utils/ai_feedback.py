"""Read accumulated user feedback for a discovery + surface and render it
as an LLM prompt block.

Lets every generation endpoint fold persisted user notes into the prompt
without each route having to know about the ``ai_feedback`` collection.
"""

from __future__ import annotations

import logging

from app.providers.storage import get_storage_provider

logger = logging.getLogger(__name__)

_MAX_ENTRIES = 20
_MAX_BLOCK_CHARS = 3000


async def render_feedback_block(
    discovery_id: str,
    surface: str,
    *,
    item_key: str | None = None,
) -> str:
    """Return a ``User feedback to apply:`` prompt block, or an empty string.

    Reads up to ``_MAX_ENTRIES`` feedback entries from the ``ai_feedback``
    collection, oldest-first. Truncates the rendered block to keep token
    spend predictable.
    """
    if not discovery_id or not surface:
        return ""
    storage = get_storage_provider()
    query: dict = {"discovery_id": discovery_id, "surface": surface}
    if item_key is not None:
        query["item_key"] = item_key
    try:
        rows = await storage.list("ai_feedback", query)
    except Exception:
        logger.warning("ai_feedback: failed to list for %s/%s", discovery_id, surface, exc_info=True)
        return ""
    if not rows:
        return ""

    rows.sort(key=lambda r: r.get("created_at", ""))
    entries: list[str] = []
    for row in rows[-_MAX_ENTRIES:]:
        text = (row.get("feedback") or "").strip()
        if text:
            entries.append(f"- {text}")
    if not entries:
        return ""

    body = "\n".join(entries)
    if len(body) > _MAX_BLOCK_CHARS:
        body = body[: _MAX_BLOCK_CHARS - 16].rstrip() + "\n- …[truncated]"
    return "User feedback to apply on this regeneration:\n" + body
