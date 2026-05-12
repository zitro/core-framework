"""Fold filled methodology templates into LLM prompts for a discovery.

Reads every saved record from the ``methodology_artifacts`` collection
for a discovery and emits a single prompt block, grouped by method and
labeled by each instance's title.
"""

from __future__ import annotations

import logging

from app.providers.storage import get_storage_provider

logger = logging.getLogger(__name__)

_MAX_BLOCK_CHARS = 4500
_METHOD_LABELS: dict[str, str] = {
    "empathy-map": "Empathy Map",
    "hmw-board": "How Might We",
    "persona": "Persona",
    "journey-map": "Journey Map",
    "assumption-matrix": "Assumption Matrix",
    "champion-map": "Champion Map",
}


async def render_methodology_block(discovery_id: str) -> str:
    """Return a ``Methodology context:`` prompt block, or an empty string."""
    if not discovery_id:
        return ""
    storage = get_storage_provider()
    try:
        rows = await storage.list("methodology_artifacts", {"discovery_id": discovery_id})
    except Exception:
        logger.warning("methodology_artifacts: failed to list for %s", discovery_id, exc_info=True)
        return ""
    if not rows:
        return ""

    rows.sort(key=lambda r: (r.get("method_id", ""), r.get("created_at", "")))
    by_method: dict[str, list[dict]] = {}
    for r in rows:
        non_empty = {
            k: (v or "").strip() for k, v in (r.get("fields") or {}).items() if (v or "").strip()
        }
        if not non_empty and not (r.get("title") or "").strip():
            continue
        by_method.setdefault(r.get("method_id", ""), []).append(r)

    if not by_method:
        return ""

    sections: list[str] = []
    for method_id, instances in by_method.items():
        label = _METHOD_LABELS.get(method_id, method_id.replace("-", " ").title())
        method_lines = [f"- {label}:"]
        for inst in instances:
            title = (inst.get("title") or "Untitled").strip()
            fields = {
                k: (v or "").strip()
                for k, v in (inst.get("fields") or {}).items()
                if (v or "").strip()
            }
            method_lines.append(f"  · {title}")
            for k, v in fields.items():
                method_lines.append(f"      - {k}: {v}")
        sections.append("\n".join(method_lines))

    body = "\n".join(sections)
    if len(body) > _MAX_BLOCK_CHARS:
        body = body[: _MAX_BLOCK_CHARS - 16].rstrip() + "\n…[truncated]"
    return (
        "Methodology context the team has captured for this discovery — "
        "use these as grounding for your output:\n" + body
    )
