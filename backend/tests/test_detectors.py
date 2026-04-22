"""Unit tests for synthesis detectors.

Detectors are pure functions of (artifacts, critiques, corpus); these
tests pin down the contract for each rule so future refactors can't
silently change semantics.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.synthesis.categories import Category
from app.synthesis.detectors import (
    detect_broken_citations,
    detect_contradictions,
    detect_low_grounding,
    detect_missing_critical,
    detect_stale_vs_corpus,
    detect_thin_coverage,
    run_detectors,
    summarise,
)
from app.synthesis.models import (
    Artifact,
    ArtifactStatus,
    Citation,
    Corpus,
    Critique,
    CritiqueIssue,
    IssueSeverity,
    SourceDoc,
    SourceKind,
)


def _doc(doc_id: str, modified: datetime | None = None) -> SourceDoc:
    return SourceDoc(
        id=doc_id,
        kind=SourceKind.VERTEX,
        title=doc_id,
        text="content",
        last_modified=modified.isoformat() if modified else "",
    )


def _artifact(
    artifact_id: str,
    type_id: str,
    *,
    body: dict | None = None,
    citations: list[Citation] | None = None,
    updated_at: datetime | None = None,
    title: str = "",
) -> Artifact:
    return Artifact(
        id=artifact_id,
        project_id="p1",
        type_id=type_id,
        category=Category.WHY,
        title=title or type_id,
        body=body or {},
        citations=citations or [],
        status=ArtifactStatus.DRAFT,
        updated_at=updated_at or datetime.now(UTC),
    )


def test_missing_critical_flags_each_missing_type() -> None:
    signals = detect_missing_critical([])
    assert all(s.kind == "missing-critical" for s in signals)
    assert all(s.severity == IssueSeverity.WARN for s in signals)
    assert all(s.action == "regenerate" for s in signals)
    assert len(signals) >= 1, "registry has at least one critical type"


def test_missing_critical_silent_when_present() -> None:
    a = _artifact("a1", "problem-statement")
    signals = detect_missing_critical([a])
    assert all(s.artifact_type_id != "problem-statement" for s in signals)


def test_low_grounding_below_threshold() -> None:
    a = _artifact("a1", "problem-statement")
    crit = Critique(
        project_id="p1",
        artifact_id="a1",
        artifact_type_id="problem-statement",
        score=0.3,
        issues=[],
    )
    signals = detect_low_grounding([a], {"a1": crit})
    assert len(signals) == 1
    assert signals[0].severity == IssueSeverity.WARN
    assert signals[0].artifact_id == "a1"


def test_low_grounding_blocker_promotes_severity() -> None:
    a = _artifact("a1", "problem-statement")
    crit = Critique(
        project_id="p1",
        artifact_id="a1",
        artifact_type_id="problem-statement",
        score=0.9,
        issues=[
            CritiqueIssue(
                severity=IssueSeverity.BLOCKER,
                dimension="grounding",
                message="unsourced",
            )
        ],
    )
    signals = detect_low_grounding([a], {"a1": crit})
    assert len(signals) == 1
    assert signals[0].severity == IssueSeverity.BLOCKER


def test_low_grounding_silent_when_healthy() -> None:
    a = _artifact("a1", "problem-statement")
    crit = Critique(
        project_id="p1",
        artifact_id="a1",
        artifact_type_id="problem-statement",
        score=0.85,
        issues=[],
    )
    assert detect_low_grounding([a], {"a1": crit}) == []


def test_broken_citation_detects_unknown_source_id() -> None:
    a = _artifact(
        "a1",
        "problem-statement",
        citations=[Citation(source_id="vertex:gone.md")],
    )
    corpus = Corpus(project_id="p1", docs=[_doc("vertex:still-here.md")])
    signals = detect_broken_citations([a], corpus)
    assert len(signals) == 1
    assert "vertex:gone.md" in signals[0].message


def test_broken_citation_silent_when_all_valid() -> None:
    a = _artifact(
        "a1",
        "problem-statement",
        citations=[Citation(source_id="vertex:ok.md")],
    )
    corpus = Corpus(project_id="p1", docs=[_doc("vertex:ok.md")])
    assert detect_broken_citations([a], corpus) == []


def test_contradiction_severity_is_blocker() -> None:
    a = _artifact("a1", "problem-statement")
    crit = Critique(
        project_id="p1",
        artifact_id="a1",
        artifact_type_id="problem-statement",
        score=0.6,
        issues=[
            CritiqueIssue(
                severity=IssueSeverity.WARN,
                dimension="contradiction",
                message="x contradicts y",
            )
        ],
    )
    signals = detect_contradictions({"a1": a}, [crit])
    assert len(signals) == 1
    assert signals[0].severity == IssueSeverity.BLOCKER


def test_thin_coverage_flags_empty_required_field() -> None:
    a = _artifact(
        "a1",
        "problem-statement",
        body={"statement": "real text", "evidence": []},
    )
    signals = detect_thin_coverage([a])
    assert len(signals) == 1
    assert "evidence" in signals[0].message


def test_thin_coverage_silent_when_filled() -> None:
    a = _artifact(
        "a1",
        "problem-statement",
        body={"statement": "real text", "evidence": ["e1"]},
    )
    assert detect_thin_coverage([a]) == []


def test_stale_vs_corpus_flags_newer_source() -> None:
    older = datetime.now(UTC) - timedelta(days=1)
    newer = datetime.now(UTC) + timedelta(days=1)
    a = _artifact(
        "a1",
        "problem-statement",
        citations=[Citation(source_id="vertex:notes.md")],
        updated_at=older,
    )
    corpus = Corpus(
        project_id="p1",
        docs=[_doc("vertex:notes.md", modified=newer)],
    )
    signals = detect_stale_vs_corpus([a], corpus)
    assert len(signals) == 1
    assert signals[0].kind == "stale-vs-corpus"


def test_stale_vs_corpus_silent_when_artifact_newer() -> None:
    older = datetime.now(UTC) - timedelta(days=2)
    newer = datetime.now(UTC)
    a = _artifact(
        "a1",
        "problem-statement",
        citations=[Citation(source_id="vertex:notes.md")],
        updated_at=newer,
    )
    corpus = Corpus(
        project_id="p1",
        docs=[_doc("vertex:notes.md", modified=older)],
    )
    assert detect_stale_vs_corpus([a], corpus) == []


def test_run_detectors_sorts_blocker_first() -> None:
    a = _artifact("a1", "problem-statement")
    crit_blocker = Critique(
        project_id="p1",
        artifact_id="a1",
        artifact_type_id="problem-statement",
        score=0.2,
        issues=[
            CritiqueIssue(
                severity=IssueSeverity.BLOCKER,
                dimension="grounding",
                message="x",
            )
        ],
    )
    corpus = Corpus(project_id="p1", docs=[])
    signals = run_detectors([a], [crit_blocker], corpus)
    assert signals[0].severity == IssueSeverity.BLOCKER


def test_signal_id_is_deterministic() -> None:
    a = _artifact("a1", "problem-statement")
    corpus = Corpus(project_id="p1", docs=[])
    s1 = run_detectors([a], [], corpus)
    s2 = run_detectors([a], [], corpus)
    assert [s.id for s in s1] == [s.id for s in s2]


def test_summarise_counts_severities() -> None:
    a = _artifact("a1", "problem-statement")
    crit = Critique(
        project_id="p1",
        artifact_id="a1",
        artifact_type_id="problem-statement",
        score=0.2,
        issues=[],
    )
    corpus = Corpus(project_id="p1", docs=[])
    signals = run_detectors([a], [crit], corpus)
    counts = summarise(signals)
    assert set(counts.keys()) == {"info", "warn", "blocker"}
    assert sum(counts.values()) == len(signals)
