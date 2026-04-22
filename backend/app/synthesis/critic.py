"""Critic v1.

Audits a draft artifact against (a) the corpus and (b) the artifact's
required schema. Emits a score and a list of issues. Persists the result
keyed by ``artifact_id`` so the UI can render it next to the artifact.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import settings
from app.providers.llm import get_llm_provider
from app.providers.storage import get_storage_provider
from app.synthesis.models import Artifact, Corpus, Critique, CritiqueIssue, IssueSeverity
from app.synthesis.prompts import critique_prompt, list_source_ids
from app.synthesis.types import get_type
from app.utils.audit import stamp_create, stamp_update

logger = logging.getLogger(__name__)

CRITIQUES_COLLECTION = "critiques"


class CriticAgent:
    async def critique(self, artifact: Artifact, corpus: Corpus) -> Critique:
        artifact_type = get_type(artifact.type_id)

        deterministic = self._deterministic_checks(artifact, artifact_type, corpus)
        llm_score, llm_issues = await self._llm_pass(artifact, corpus)

        score = self._combine_score(deterministic, llm_score)
        issues = deterministic + llm_issues

        critique = Critique(
            project_id=artifact.project_id,
            artifact_id=str(artifact.id),
            artifact_type_id=artifact.type_id,
            score=score,
            issues=issues,
            model=getattr(settings, "azure_openai_deployment", "") or settings.llm_provider,
        )
        return await self._persist(critique)

    # ── checks ────────────────────────────────────────────

    def _deterministic_checks(
        self, artifact: Artifact, artifact_type, corpus: Corpus
    ) -> list[CritiqueIssue]:
        out: list[CritiqueIssue] = []
        valid_ids = list_source_ids(corpus)

        # grounding: at least one citation, all valid
        if not artifact.citations:
            out.append(
                CritiqueIssue(
                    severity=IssueSeverity.BLOCKER,
                    dimension="grounding",
                    message="Artifact has no citations.",
                )
            )
        else:
            invalid = [c for c in artifact.citations if c.source_id not in valid_ids]
            if invalid:
                out.append(
                    CritiqueIssue(
                        severity=IssueSeverity.WARN,
                        dimension="grounding",
                        message=f"{len(invalid)} citation(s) reference unknown source ids.",
                    )
                )

        # completeness: required body fields
        for field, hint in artifact_type.body_schema.items():
            value = artifact.body.get(field) if isinstance(artifact.body, dict) else None
            if value in (None, "", [], {}):
                out.append(
                    CritiqueIssue(
                        severity=IssueSeverity.WARN,
                        dimension="completeness",
                        message=f"Field '{field}' is empty ({hint}).",
                        field=field,
                    )
                )

        # clarity: summary sanity
        if not artifact.summary or len(artifact.summary) < 30:
            out.append(
                CritiqueIssue(
                    severity=IssueSeverity.INFO,
                    dimension="clarity",
                    message="Summary is missing or very short.",
                    field="summary",
                )
            )

        return out

    async def _llm_pass(
        self, artifact: Artifact, corpus: Corpus
    ) -> tuple[float, list[CritiqueIssue]]:
        artifact_type = get_type(artifact.type_id)
        system, user = critique_prompt(
            artifact_type, {"summary": artifact.summary, "body": artifact.body}, corpus
        )
        try:
            llm = get_llm_provider()
            raw: dict[str, Any] = await llm.complete_json(system, user)
        except Exception:
            logger.warning("critic: LLM pass failed", exc_info=True)
            return 0.5, []

        score_raw = raw.get("score", 0.5)
        try:
            score = max(0.0, min(1.0, float(score_raw)))
        except Exception:
            score = 0.5

        issues_raw = raw.get("issues") or []
        issues: list[CritiqueIssue] = []
        if isinstance(issues_raw, list):
            for i in issues_raw[:20]:
                if not isinstance(i, dict):
                    continue
                try:
                    issues.append(
                        CritiqueIssue(
                            severity=IssueSeverity(i.get("severity", "info")),
                            dimension=str(i.get("dimension") or "clarity")[:32],
                            message=str(i.get("message") or "")[:500],
                            field=str(i.get("field") or "")[:128],
                        )
                    )
                except Exception:
                    continue
        return score, issues

    @staticmethod
    def _combine_score(deterministic: list[CritiqueIssue], llm_score: float) -> float:
        # one blocker -> cap at 0.4; warns shave 0.05 each
        cap = 1.0
        if any(i.severity == IssueSeverity.BLOCKER for i in deterministic):
            cap = 0.4
        warns = sum(1 for i in deterministic if i.severity == IssueSeverity.WARN)
        adjusted = llm_score - 0.05 * warns
        return round(max(0.0, min(cap, adjusted)), 3)

    # ── persistence ───────────────────────────────────────

    async def _persist(self, critique: Critique) -> Critique:
        storage = get_storage_provider()
        # one critique per artifact_id, latest wins
        existing = None
        for key in ("artifact_id", "artifactId"):
            try:
                items = await storage.list(CRITIQUES_COLLECTION, {key: critique.artifact_id})
            except Exception:
                items = []
            if items:
                existing = items[0]
                break

        payload = critique.model_dump(mode="json")
        if existing:
            payload["id"] = existing["id"]
            payload["created_at"] = existing.get("created_at", payload["created_at"])
            stamp_update(payload)
            saved = await storage.update(CRITIQUES_COLLECTION, payload["id"], payload)
        else:
            saved = await storage.create(CRITIQUES_COLLECTION, stamp_create(payload))
        return Critique(**saved)
