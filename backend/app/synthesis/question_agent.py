"""Question agent.

Looks at the project's current artifact set + corpus, identifies the
artifact types that are missing or weakly grounded, and produces a ranked
list of customer questions whose answers would unblock them.
"""

from __future__ import annotations

import logging
from typing import Any

from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.synthesis.models import Artifact, Corpus, Question
from app.synthesis.prompts import questions_prompt
from app.synthesis.types import ARTIFACT_TYPES
from app.utils.audit import stamp_create

logger = logging.getLogger(__name__)

QUESTIONS_COLLECTION = "synthesis_questions"


class QuestionAgent:
    async def generate(
        self,
        project: dict,
        artifacts: list[Artifact],
        corpus: Corpus,
    ) -> list[Question]:
        existing_type_ids = {a.type_id for a in artifacts}
        critical_missing = [
            t.id for t in ARTIFACT_TYPES if t.critical and t.id not in existing_type_ids
        ]

        artifact_dicts = [a.model_dump(mode="json") for a in artifacts]
        system, user = questions_prompt(artifact_dicts, corpus, critical_missing)

        try:
            raw: dict[str, Any] = await get_llm_provider().complete_json(system, user)
        except Exception:
            logger.warning("question agent: LLM call failed", exc_info=True)
            return []

        items = raw.get("questions") or []
        if not isinstance(items, list):
            return []

        project_id = str(project.get("id") or "")
        questions: list[Question] = []
        for q in items[:20]:
            if not isinstance(q, dict):
                continue
            text = str(q.get("text") or "").strip()
            if not text:
                continue
            try:
                priority = max(1, min(5, int(q.get("priority", 3))))
            except Exception:
                priority = 3
            questions.append(
                Question(
                    project_id=project_id,
                    text=text[:500],
                    rationale=str(q.get("rationale") or "")[:500],
                    target_artifact_type_id=str(q.get("target_artifact_type_id") or "")[:64],
                    priority=priority,
                )
            )

        await self._replace_existing(project_id, questions)
        return questions

    async def _replace_existing(self, project_id: str, fresh: list[Question]) -> None:
        """Remove old unanswered questions for the project, keep answered ones."""
        storage = get_storage_provider()
        for key in ("project_id", "projectId"):
            try:
                items = await storage.list(QUESTIONS_COLLECTION, {key: project_id})
            except Exception:
                items = []
            if items:
                for item in items:
                    if item.get("answered"):
                        continue
                    try:
                        await storage.delete(QUESTIONS_COLLECTION, str(item.get("id", "")))
                    except Exception:
                        pass
                break

        for q in fresh:
            try:
                await storage.create(QUESTIONS_COLLECTION, stamp_create(q.model_dump(mode="json")))
            except Exception:
                logger.warning("question agent: failed to persist question", exc_info=True)
