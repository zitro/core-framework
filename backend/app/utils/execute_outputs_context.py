"""Execute output context loading and fingerprinting."""

from __future__ import annotations

import hashlib
import logging

from app.models.core import ExecuteOutputVersion
from app.providers.storage import get_storage_provider
from app.utils.context import gather_context

logger = logging.getLogger(__name__)


def fingerprint(context: str) -> str:
    return hashlib.sha256(context.encode("utf-8")).hexdigest()


async def load_outputs(discovery_id: str) -> list[ExecuteOutputVersion]:
    storage = get_storage_provider()
    items = await storage.list("execute_outputs", {"discoveryId": discovery_id})
    if not items:
        items = await storage.list("execute_outputs", {"discovery_id": discovery_id})
    outputs = [ExecuteOutputVersion(**item) for item in items]
    outputs.sort(key=lambda item: (item.output_id, item.version, item.created_at))
    return outputs


def latest_by_output(
    outputs: list[ExecuteOutputVersion],
) -> dict[str, ExecuteOutputVersion]:
    latest: dict[str, ExecuteOutputVersion] = {}
    for output in outputs:
        current = latest.get(output.output_id)
        if current is None or output.version >= current.version:
            latest[output.output_id] = output
    return latest


async def execute_context(discovery_id: str) -> str:
    storage = get_storage_provider()
    parts = [await gather_context(discovery_id)]

    for collection, label in [
        ("context_briefs", "Project understanding"),
        ("problem_statements", "Problem statement versions"),
        ("use_cases", "Use case versions"),
        ("solution_blueprints", "Solution blueprint versions"),
        ("execute_outputs", "Prior Execute outputs"),
    ]:
        try:
            items = await storage.list(collection, {"discoveryId": discovery_id})
            if not items:
                items = await storage.list(collection, {"discovery_id": discovery_id})
            if items:
                recent = items[-3:] if collection != "execute_outputs" else []
                if recent:
                    parts.append(f"{label}:\n" + "\n".join(str(item) for item in recent))
        except Exception:
            logger.debug("Could not load %s for execute context", collection)

    return "\n\n".join(part for part in parts if part and part.strip())
