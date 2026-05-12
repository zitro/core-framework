"""Execute output generation pipeline."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from app.models.core import ExecuteOutputVersion
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create
from app.utils.execute_outputs_context import load_outputs
from app.utils.execute_outputs_definitions import (
    ExecuteOutputDefinition,
    build_system_prompt,
)
from app.utils.review_gate import auto_request_review

logger = logging.getLogger(__name__)


def normalize_sections(raw_sections: object) -> list[dict[str, str]]:
    if not isinstance(raw_sections, list):
        return []
    sections: list[dict[str, str]] = []
    for section in raw_sections:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title", "")).strip()
        body = str(section.get("body", "")).strip()
        if title or body:
            sections.append({"title": title or "Section", "body": body})
    return sections


async def generate_output(
    discovery_id: str,
    definition: ExecuteOutputDefinition,
    context: str,
    context_fingerprint: str,
) -> ExecuteOutputVersion:
    if not context.strip():
        raise HTTPException(
            status_code=422,
            detail="No context available. Complete Capture, Orchestrate, or Refine before generating Execute outputs.",
        )

    storage = get_storage_provider()
    existing = [
        item for item in await load_outputs(discovery_id) if item.output_id == definition.id
    ]
    next_version = len(existing) + 1

    user_prompt = (
        f"Complete discovery context:\n\n{context}\n\n"
        f"Generate {definition.title} version {next_version}.\n"
        f"Specific artifact focus: {definition.focus}"
    )

    try:
        result = await get_llm_provider().complete_json(
            build_system_prompt(definition),
            user_prompt,
            max_tokens=2800,
        )
    except Exception:
        logger.exception("LLM call failed for execute output %s", definition.id)
        raise HTTPException(status_code=502, detail="AI service unavailable")

    output = ExecuteOutputVersion(
        discovery_id=discovery_id,
        output_id=definition.id,
        title=definition.title,
        description=definition.description,
        audience=definition.audience,
        style=definition.style,
        category=definition.category,
        version=next_version,
        headline=str(result.get("headline", "")).strip(),
        summary=str(result.get("summary", "")).strip(),
        sections=normalize_sections(result.get("sections")),
        focus=definition.focus,
        context_fingerprint=context_fingerprint,
        context_used=context[:4000],
    )

    try:
        saved = await storage.create(
            "execute_outputs", stamp_create(output.model_dump(mode="json"))
        )
    except Exception:
        logger.exception("Failed to save execute output %s", definition.id)
        raise HTTPException(status_code=500, detail="Failed to save Execute output")

    await auto_request_review(
        artifact_collection="execute_outputs",
        artifact_id=str(saved.get("id", "")),
        artifact_title=f"{definition.title} v{next_version}",
        discovery_id=discovery_id,
    )

    return ExecuteOutputVersion(**saved)
