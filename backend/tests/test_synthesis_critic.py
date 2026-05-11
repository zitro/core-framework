"""Critic round-trip tests.

Wires a fake LLM and asserts:
  - critique() saves a Critique row keyed by artifact_id
  - deterministic checks fire even when the LLM returns nothing
  - score combination clamps to [0.0, 1.0]
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from app.providers.storage import get_storage_provider
from app.synthesis.categories import Category
from app.synthesis.critic import CRITIQUES_COLLECTION, CriticAgent
from app.synthesis.models import (
    Artifact,
    ArtifactStatus,
    Citation,
    Corpus,
    IssueSeverity,
    SourceDoc,
    SourceKind,
)

pytestmark = pytest.mark.asyncio


class _CleanLLM:
    """Critic LLM that reports no issues."""

    async def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return {"score": 0.9, "issues": []}


class _NoisyLLM:
    """Critic LLM that surfaces one warn."""

    async def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return {
            "score": 0.4,
            "issues": [
                {
                    "severity": "warn",
                    "dimension": "clarity",
                    "message": "Title is vague.",
                    "field": "title",
                }
            ],
        }


def _corpus() -> Corpus:
    return Corpus(
        project_id="p1",
        docs=[
            SourceDoc(id="src-1", kind=SourceKind.LOCAL_DIR, title="A", text="some text"),
            SourceDoc(id="src-2", kind=SourceKind.LOCAL_DIR, title="B", text="more text"),
        ],
    )


def _artifact_grounded() -> Artifact:
    return Artifact(
        id="a-grounded",
        project_id="p1",
        type_id="problem-statement",
        category=Category.WHY,
        title="Claims pain",
        summary="Claims agents juggle 3 tools.",
        body={"statement": "Claims agents juggle 3 tools.", "evidence": []},
        citations=[Citation(source_id="src-1", quote="...")],
        status=ArtifactStatus.DRAFT,
    )


def _artifact_ungrounded() -> Artifact:
    """Same artifact, no citations — deterministic check should blocker."""
    return Artifact(
        id="a-ungrounded",
        project_id="p1",
        type_id="problem-statement",
        category=Category.WHY,
        title="Claims pain",
        summary="Claims agents juggle 3 tools.",
        body={"statement": "x", "evidence": []},
        citations=[],
    )


async def test_critique_persists_row_keyed_by_artifact_id() -> None:
    agent = CriticAgent()
    with patch("app.synthesis.critic.get_llm_provider", return_value=_CleanLLM()):
        critique = await agent.critique(_artifact_grounded(), _corpus())

    storage = get_storage_provider()
    saved = await storage.list(CRITIQUES_COLLECTION, {"project_id": "p1"})
    assert len(saved) == 1
    assert saved[0]["artifact_id"] == critique.artifact_id == "a-grounded"
    assert saved[0]["artifact_type_id"] == "problem-statement"


async def test_critique_blocker_on_missing_citations() -> None:
    agent = CriticAgent()
    with patch("app.synthesis.critic.get_llm_provider", return_value=_CleanLLM()):
        critique = await agent.critique(_artifact_ungrounded(), _corpus())

    blockers = [i for i in critique.issues if i.severity is IssueSeverity.BLOCKER]
    assert any(i.dimension == "grounding" for i in blockers), (
        "deterministic check should have flagged grounding"
    )


async def test_critique_score_clamps_to_unit_interval() -> None:
    agent = CriticAgent()

    class _WildLLM:
        async def complete_json(self, system: str, user: str) -> dict[str, Any]:
            return {"score": 99.0, "issues": []}

    with patch("app.synthesis.critic.get_llm_provider", return_value=_WildLLM()):
        critique = await agent.critique(_artifact_grounded(), _corpus())
    assert 0.0 <= critique.score <= 1.0


async def test_critique_merges_llm_and_deterministic_issues() -> None:
    """Both lists feed the final issues array."""
    agent = CriticAgent()
    with patch("app.synthesis.critic.get_llm_provider", return_value=_NoisyLLM()):
        critique = await agent.critique(_artifact_grounded(), _corpus())

    dimensions = {i.dimension for i in critique.issues}
    # LLM's "clarity" issue must be present; deterministic checks may add more.
    assert "clarity" in dimensions
