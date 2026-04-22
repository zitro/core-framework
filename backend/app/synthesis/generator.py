"""Generator engine.

Given a project, an artifact type, and a corpus, produce a draft
``Artifact``: call the LLM, validate citations, persist via storage, and
return the saved record.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import settings
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.synthesis.models import Artifact, ArtifactStatus, Citation, Corpus
from app.synthesis.prompts import (
    filter_citations,
    generation_prompt,
    list_source_ids,
)
from app.synthesis.types import ArtifactType, get_type
from app.utils.audit import stamp_create, stamp_update
from app.utils.audit_log import audit

logger = logging.getLogger(__name__)

ARTIFACTS_COLLECTION = "artifacts"


class GeneratorEngine:
    """LLM-driven artifact generator."""

    async def generate(
        self,
        project: dict,
        type_id: str,
        instructions: str = "",
        *,
        corpus: Corpus,
    ) -> Artifact:
        artifact_type = get_type(type_id)
        system, user = generation_prompt(artifact_type, corpus, instructions)

        llm = get_llm_provider()
        try:
            raw = await llm.complete_json(system, user)
        except Exception:
            logger.exception("generator: LLM call failed for %s", type_id)
            raise

        artifact = self._build_artifact(project, artifact_type, raw, corpus)
        return await self._persist(artifact)

    def _build_artifact(
        self,
        project: dict,
        artifact_type: ArtifactType,
        raw: dict[str, Any],
        corpus: Corpus,
    ) -> Artifact:
        valid_ids = list_source_ids(corpus)
        citations_raw = raw.get("citations") if isinstance(raw, dict) else None
        clean_citations = filter_citations(citations_raw or [], valid_ids)

        title = str(raw.get("title") or artifact_type.label)[:200]
        summary = str(raw.get("summary") or "")[:1500]
        body_value = raw.get("body") if isinstance(raw, dict) else {}
        body = body_value if isinstance(body_value, dict) else {"content": body_value}

        return Artifact(
            project_id=str(project.get("id") or ""),
            type_id=artifact_type.id,
            category=artifact_type.category,
            title=title,
            summary=summary,
            body=body,
            citations=[Citation(**c) for c in clean_citations],
            status=ArtifactStatus.DRAFT,
            generated_by="synthesis.generator",
            model=getattr(settings, "azure_openai_deployment", "") or settings.llm_provider,
        )

    async def _persist(self, artifact: Artifact) -> Artifact:
        storage = get_storage_provider()
        existing = await self._find_existing(artifact)
        payload = artifact.model_dump(mode="json")

        if existing:
            payload["id"] = existing["id"]
            payload["version"] = int(existing.get("version", 1)) + 1
            payload["created_at"] = existing.get("created_at", payload["created_at"])
            stamp_update(payload)
            saved = await storage.update(ARTIFACTS_COLLECTION, payload["id"], payload)
            await audit(
                "synthesis.regenerate",
                collection=ARTIFACTS_COLLECTION,
                item_id=payload["id"],
                summary=f"{artifact.type_id} v{payload['version']}: {artifact.title[:80]}",
                after=saved,
            )
            return Artifact(**saved)

        saved = await storage.create(ARTIFACTS_COLLECTION, stamp_create(payload))
        await audit(
            "synthesis.create",
            collection=ARTIFACTS_COLLECTION,
            item_id=str(saved.get("id", "")),
            summary=f"{artifact.type_id}: {artifact.title[:80]}",
            after=saved,
        )
        return Artifact(**saved)

    async def _find_existing(self, artifact: Artifact) -> dict | None:
        storage = get_storage_provider()
        # try project_id (snake_case) first, then projectId for legacy partition keys
        for key in ("project_id", "projectId"):
            try:
                items = await storage.list(
                    ARTIFACTS_COLLECTION,
                    {key: artifact.project_id, "type_id": artifact.type_id},
                )
            except Exception:
                items = []
            if items:
                return items[0]
        return None
