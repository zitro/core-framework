"""Unit tests for DT Compass + auto-rebuild target selection."""

from __future__ import annotations

from datetime import UTC, datetime

from app.synthesis.categories import Category
from app.synthesis.compass import (
    compute_compass,
    types_to_auto_regenerate,
)
from app.synthesis.detectors import Signal
from app.synthesis.models import Artifact, ArtifactStatus, IssueSeverity
from app.synthesis.types import ARTIFACT_TYPES

_WHY_CRITICAL = [t.id for t in ARTIFACT_TYPES if t.category == Category.WHY and t.critical]
_FIRST_WHY_CRITICAL = _WHY_CRITICAL[0]


def _all_why_critical_artifacts(
    status: ArtifactStatus = ArtifactStatus.APPROVED,
) -> list[Artifact]:
    return [_artifact(f"a-{tid}", tid, Category.WHY, status=status) for tid in _WHY_CRITICAL]


def _artifact(
    artifact_id: str,
    type_id: str,
    category: Category,
    status: ArtifactStatus = ArtifactStatus.APPROVED,
) -> Artifact:
    return Artifact(
        id=artifact_id,
        project_id="p1",
        type_id=type_id,
        category=category,
        title=type_id,
        body={},
        citations=[],
        status=status,
        updated_at=datetime.now(UTC),
    )


def _signal(kind: str, severity: IssueSeverity, type_id: str) -> Signal:
    return Signal(
        id=f"sig-{kind}-{type_id}",
        kind=kind,
        severity=severity,
        title=f"{kind} {type_id}",
        message="x",
        artifact_id=type_id,
        artifact_type_id=type_id,
        action="regenerate",
    )


def test_compass_green_when_clean() -> None:
    artifacts = _all_why_critical_artifacts()
    snap = compute_compass("p1", artifacts, [])
    why = next(c for c in snap.categories if c.category == Category.WHY)
    assert why.health == "green"
    assert why.present == len(_WHY_CRITICAL)
    assert why.draft == 0
    # other categories likely red because other criticals are missing
    assert snap.overall == "red"


def test_compass_red_when_blocker_signal() -> None:
    artifacts = _all_why_critical_artifacts()
    signals = [_signal("low-grounding", IssueSeverity.BLOCKER, _FIRST_WHY_CRITICAL)]
    snap = compute_compass("p1", artifacts, signals)
    why = next(c for c in snap.categories if c.category == Category.WHY)
    assert why.health == "red"
    assert why.blocker_signals == 1
    assert snap.overall == "red"


def test_compass_amber_when_only_warn() -> None:
    artifacts = _all_why_critical_artifacts()
    signals = [_signal("broken-citation", IssueSeverity.WARN, _FIRST_WHY_CRITICAL)]
    snap = compute_compass("p1", artifacts, signals)
    why = next(c for c in snap.categories if c.category == Category.WHY)
    assert why.health == "amber"
    assert why.warn_signals == 1


def test_compass_amber_when_more_drafts_than_accepted() -> None:
    artifacts = _all_why_critical_artifacts(status=ArtifactStatus.DRAFT)
    snap = compute_compass("p1", artifacts, [])
    why = next(c for c in snap.categories if c.category == Category.WHY)
    assert why.draft == len(_WHY_CRITICAL)
    assert why.present == 0
    assert why.health == "amber"


def test_compass_critical_missing_promotes_red() -> None:
    snap = compute_compass("p1", [], [])
    # at least one category should be red because critical types are missing
    assert any(c.health == "red" for c in snap.categories)
    assert snap.overall == "red"


def test_compass_includes_operational_category() -> None:
    snap = compute_compass("p1", [], [])
    cats = {c.category for c in snap.categories}
    assert Category.OPERATIONAL in cats


def test_auto_regenerate_picks_only_safe_kinds() -> None:
    signals = [
        _signal("stale-vs-corpus", IssueSeverity.INFO, "problem-statement"),
        _signal("broken-citation", IssueSeverity.WARN, "persona"),
        _signal("low-grounding", IssueSeverity.BLOCKER, "problem-statement"),
        _signal("contradiction", IssueSeverity.BLOCKER, "persona"),
    ]
    targets = types_to_auto_regenerate(signals)
    assert "problem-statement" in targets
    assert "persona" in targets
    # low-grounding and contradiction don't add anything new — deduped
    assert len(targets) == 2


def test_auto_regenerate_dedupes_and_skips_unknown_types() -> None:
    signals = [
        _signal("stale-vs-corpus", IssueSeverity.INFO, "problem-statement"),
        _signal("broken-citation", IssueSeverity.WARN, "problem-statement"),
        _signal("stale-vs-corpus", IssueSeverity.INFO, "made-up-type-id"),
    ]
    targets = types_to_auto_regenerate(signals)
    assert targets == ["problem-statement"]


def test_auto_regenerate_skips_signals_without_type_id() -> None:
    sig = Signal(
        id="x",
        kind="stale-vs-corpus",
        severity=IssueSeverity.INFO,
        title="t",
        message="m",
    )
    assert types_to_auto_regenerate([sig]) == []
