"""Round-trip + shape tests for the synthesis Pydantic models."""

from __future__ import annotations

from datetime import datetime

import pytest

from app.synthesis.categories import Category
from app.synthesis.models import (
    Artifact,
    ArtifactStatus,
    Citation,
    Corpus,
    Critique,
    CritiqueIssue,
    IssueSeverity,
    Question,
    SourceDoc,
    SourceKind,
)


def test_sourcedoc_round_trips() -> None:
    raw = {
        "id": "engagement-repo:overview",
        "kind": "engagement-repo",
        "title": "Overview",
        "uri": "/data/projects/acme/overview.md",
        "snippet": "Acme is...",
        "text": "Acme is a fintech...",
        "last_modified": "2026-05-11T00:00:00Z",
        "metadata": {"size_bytes": 1234},
    }
    doc = SourceDoc.model_validate(raw)
    assert doc.kind is SourceKind.VERTEX
    dumped = doc.model_dump(mode="json")
    assert dumped["kind"] == "engagement-repo"


def test_corpus_by_id_resolves_doc() -> None:
    a = SourceDoc(id="a", kind=SourceKind.LOCAL_DIR, title="A")
    b = SourceDoc(id="b", kind=SourceKind.WEB, title="B")
    corpus = Corpus(project_id="p1", docs=[a, b])
    assert corpus.by_id("b") is b
    assert corpus.by_id("missing") is None


def test_artifact_defaults_are_sane() -> None:
    art = Artifact(project_id="p1", type_id="problem-statement", category=Category.WHY, title="X")
    assert art.status is ArtifactStatus.DRAFT
    assert art.version == 1
    assert art.citations == []
    assert isinstance(art.created_at, datetime)
    assert art.generated_by == "synthesis.generator"


def test_artifact_round_trip() -> None:
    art = Artifact(
        project_id="p1",
        type_id="problem-statement",
        category=Category.WHY,
        title="Claims processing pain",
        summary="Claims agents juggle 3 tools.",
        body={"statement": "Claims agents juggle 3 tools.", "evidence": []},
        citations=[Citation(source_id="src1", quote="...")],
    )
    dumped = art.model_dump(mode="json")
    reborn = Artifact.model_validate(dumped)
    assert reborn.category is Category.WHY
    assert reborn.body == art.body
    assert reborn.citations[0].source_id == "src1"


@pytest.mark.parametrize("sev", list(IssueSeverity))
def test_critique_severity_round_trip(sev: IssueSeverity) -> None:
    crit = Critique(
        project_id="p1",
        artifact_id="a1",
        artifact_type_id="problem-statement",
        score=0.5,
        issues=[
            CritiqueIssue(severity=sev, dimension="grounding", message="missing citation"),
        ],
    )
    dumped = crit.model_dump(mode="json")
    reborn = Critique.model_validate(dumped)
    assert reborn.issues[0].severity is sev


def test_question_defaults() -> None:
    q = Question(project_id="p1", text="What ticketing system do you use?")
    assert q.priority == 3
    assert q.answered is False
    assert q.answer == ""
