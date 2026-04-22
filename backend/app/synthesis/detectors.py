"""Synthesis detectors.

Cheap, deterministic rules that scan a project's artifact set against the
current corpus and critic findings, emitting `Signal`s the user can act
on. Detectors never call the LLM — they're the mechanical pass that runs
every time the user opens the page.

Signals are computed on-demand and not persisted. They are a pure
function of `(artifacts, critiques, corpus)`, so caching or persistence
would only invite stale-state bugs. If product-level acknowledgment or
snooze becomes necessary, persist then.

Rules implemented:
    - missing-critical : a critical=True artifact type has no artifact
    - low-grounding    : critic score < 0.5 or has any blocker issue
    - broken-citation  : citations reference source ids absent from corpus
    - contradiction    : critic flagged dimension="contradiction"
    - thin-coverage    : required body schema fields are empty/null
    - stale-vs-corpus  : a cited source was updated after the artifact
"""

from __future__ import annotations

import hashlib
from typing import Any

from pydantic import BaseModel

from app.synthesis.models import Artifact, Corpus, Critique, IssueSeverity
from app.synthesis.types import ARTIFACT_TYPES, get_type


class Signal(BaseModel):
    """A single detector finding worth surfacing."""

    id: str  # deterministic 16-char hash; stable across recomputes
    kind: str
    severity: IssueSeverity
    title: str
    message: str
    artifact_id: str = ""
    artifact_type_id: str = ""
    action: str = ""  # "regenerate" | "answer_question" | "add_source" | ""


_SEVERITY_RANK: dict[IssueSeverity, int] = {
    IssueSeverity.BLOCKER: 0,
    IssueSeverity.WARN: 1,
    IssueSeverity.INFO: 2,
}


def _signal_id(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:16]


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, (str, list, dict, tuple, set)) and len(value) == 0:
        return True
    return False


def detect_missing_critical(artifacts: list[Artifact]) -> list[Signal]:
    have = {a.type_id for a in artifacts}
    out: list[Signal] = []
    for t in ARTIFACT_TYPES:
        if not t.critical or t.id in have:
            continue
        out.append(
            Signal(
                id=_signal_id("missing-critical", t.id),
                kind="missing-critical",
                severity=IssueSeverity.WARN,
                title=f"Missing critical artifact: {t.label}",
                message=(
                    f"`{t.id}` has not been generated. It is marked critical "
                    "for project completeness."
                ),
                artifact_type_id=t.id,
                action="regenerate",
            )
        )
    return out


def detect_low_grounding(
    artifacts: list[Artifact],
    critiques_by_artifact: dict[str, Critique],
) -> list[Signal]:
    out: list[Signal] = []
    for a in artifacts:
        c = critiques_by_artifact.get(a.id)
        if not c:
            continue
        has_blocker = any(i.severity == IssueSeverity.BLOCKER for i in c.issues)
        if not has_blocker and c.score >= 0.5:
            continue
        sev = IssueSeverity.BLOCKER if has_blocker else IssueSeverity.WARN
        reason = "blocker issues present" if has_blocker else f"critic score {c.score:.2f}"
        out.append(
            Signal(
                id=_signal_id("low-grounding", a.id),
                kind="low-grounding",
                severity=sev,
                title=f"Low confidence: {a.title or a.type_id}",
                message=(
                    f"Critic flagged this artifact ({reason}). Consider "
                    "regenerating with sharper instructions or adding sources."
                ),
                artifact_id=a.id,
                artifact_type_id=a.type_id,
                action="regenerate",
            )
        )
    return out


def detect_broken_citations(artifacts: list[Artifact], corpus: Corpus) -> list[Signal]:
    valid_ids = {d.id for d in corpus.docs}
    out: list[Signal] = []
    for a in artifacts:
        broken = [c.source_id for c in a.citations if c.source_id not in valid_ids]
        if not broken:
            continue
        preview = ", ".join(broken[:3])
        extra = f" (+{len(broken) - 3} more)" if len(broken) > 3 else ""
        out.append(
            Signal(
                id=_signal_id("broken-citation", a.id),
                kind="broken-citation",
                severity=IssueSeverity.WARN,
                title=f"Stale citations: {a.title or a.type_id}",
                message=(
                    "Citations point to source ids no longer in the corpus: "
                    f"{preview}{extra}. Regenerate to refresh."
                ),
                artifact_id=a.id,
                artifact_type_id=a.type_id,
                action="regenerate",
            )
        )
    return out


def detect_contradictions(
    artifacts_by_id: dict[str, Artifact],
    critiques: list[Critique],
) -> list[Signal]:
    out: list[Signal] = []
    for c in critiques:
        contradictions = [i for i in c.issues if i.dimension == "contradiction"]
        if not contradictions:
            continue
        a = artifacts_by_id.get(c.artifact_id)
        title = (a.title if a else c.artifact_type_id) or c.artifact_type_id
        msgs = "; ".join(i.message[:120] for i in contradictions[:3])
        out.append(
            Signal(
                id=_signal_id("contradiction", c.artifact_id),
                kind="contradiction",
                severity=IssueSeverity.BLOCKER,
                title=f"Contradiction: {title}",
                message=f"Critic flagged contradictions: {msgs}",
                artifact_id=c.artifact_id,
                artifact_type_id=c.artifact_type_id,
                action="regenerate",
            )
        )
    return out


def detect_thin_coverage(artifacts: list[Artifact]) -> list[Signal]:
    out: list[Signal] = []
    for a in artifacts:
        try:
            t = get_type(a.type_id)
        except KeyError:
            continue
        if not t.body_schema:
            continue
        empty = [f for f in t.body_schema if _is_empty(a.body.get(f))]
        if not empty:
            continue
        out.append(
            Signal(
                id=_signal_id("thin-coverage", a.id),
                kind="thin-coverage",
                severity=IssueSeverity.INFO,
                title=f"Thin coverage: {a.title or a.type_id}",
                message=f"Required body fields are empty: {', '.join(empty)}",
                artifact_id=a.id,
                artifact_type_id=a.type_id,
                action="regenerate",
            )
        )
    return out


def detect_stale_vs_corpus(artifacts: list[Artifact], corpus: Corpus) -> list[Signal]:
    docs_by_id = {d.id: d for d in corpus.docs}
    out: list[Signal] = []
    for a in artifacts:
        max_source_ts = ""
        for cit in a.citations:
            doc = docs_by_id.get(cit.source_id)
            if doc and doc.last_modified and doc.last_modified > max_source_ts:
                max_source_ts = doc.last_modified
        if not max_source_ts:
            continue
        artifact_ts = a.updated_at.isoformat()
        if max_source_ts <= artifact_ts:
            continue
        out.append(
            Signal(
                id=_signal_id("stale", a.id),
                kind="stale-vs-corpus",
                severity=IssueSeverity.INFO,
                title=f"Stale: {a.title or a.type_id}",
                message=(
                    f"A cited source was updated more recently "
                    f"({max_source_ts[:10]}) than this artifact "
                    f"({artifact_ts[:10]}). Regenerate to incorporate."
                ),
                artifact_id=a.id,
                artifact_type_id=a.type_id,
                action="regenerate",
            )
        )
    return out


def run_detectors(
    artifacts: list[Artifact],
    critiques: list[Critique],
    corpus: Corpus,
) -> list[Signal]:
    """Run every rule and return signals sorted by severity."""
    by_artifact = {c.artifact_id: c for c in critiques}
    artifacts_by_id = {a.id: a for a in artifacts if a.id}

    signals: list[Signal] = []
    signals.extend(detect_missing_critical(artifacts))
    signals.extend(detect_low_grounding(artifacts, by_artifact))
    signals.extend(detect_broken_citations(artifacts, corpus))
    signals.extend(detect_contradictions(artifacts_by_id, critiques))
    signals.extend(detect_thin_coverage(artifacts))
    signals.extend(detect_stale_vs_corpus(artifacts, corpus))

    signals.sort(key=lambda s: (_SEVERITY_RANK[s.severity], s.kind, s.title))
    return signals


def summarise(signals: list[Signal]) -> dict[str, int]:
    """Return counts per severity for header badges."""
    counts = {s.value: 0 for s in IssueSeverity}
    for sig in signals:
        counts[sig.severity.value] += 1
    return counts
