"""DT Compass.

Per-category health snapshot for a project. A pure function over the
same inputs the detectors use, packaged as a small compass card the user
sees at the top of the synthesis page so they can answer "where is this
project actually weak?" without scrolling.

Output shape per category:
    {
        category: "why",
        label: "Why",
        present: int,            # accepted artifacts in this category
        draft: int,              # draft artifacts in this category
        critical_missing: int,   # critical types with no artifact yet
        blocker_signals: int,    # detector blockers tied to this category
        warn_signals: int,       # detector warns tied to this category
        health: "green" | "amber" | "red",
    }

Health rule (deliberately simple):
    red    if any blocker_signals > 0 or critical_missing > 0
    amber  if any warn_signals > 0 or draft > present
    green  otherwise
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.synthesis.categories import CATEGORY_LABELS, CATEGORY_ORDER, Category
from app.synthesis.detectors import Signal
from app.synthesis.models import Artifact, ArtifactStatus
from app.synthesis.types import ARTIFACT_TYPES, get_type

Health = Literal["green", "amber", "red"]


class CategoryHealth(BaseModel):
    category: Category
    label: str
    present: int
    draft: int
    critical_missing: int
    blocker_signals: int
    warn_signals: int
    health: Health


class CompassSnapshot(BaseModel):
    project_id: str
    categories: list[CategoryHealth]
    overall: Health


def _health(blocker: int, missing: int, warn: int, draft: int, present: int) -> Health:
    if blocker > 0 or missing > 0:
        return "red"
    if warn > 0 or draft > present:
        return "amber"
    return "green"


def _overall(items: list[CategoryHealth]) -> Health:
    if any(c.health == "red" for c in items):
        return "red"
    if any(c.health == "amber" for c in items):
        return "amber"
    return "green"


def compute_compass(
    project_id: str,
    artifacts: list[Artifact],
    signals: list[Signal],
) -> CompassSnapshot:
    """Compute per-category health from artifacts + already-detected signals."""
    by_cat: dict[Category, list[Artifact]] = {c: [] for c in CATEGORY_ORDER}
    for a in artifacts:
        if a.category in by_cat:
            by_cat[a.category].append(a)

    sig_blocker_by_type: dict[str, int] = {}
    sig_warn_by_type: dict[str, int] = {}
    for s in signals:
        if not s.artifact_type_id:
            continue
        if s.severity.value == "blocker":
            sig_blocker_by_type[s.artifact_type_id] = (
                sig_blocker_by_type.get(s.artifact_type_id, 0) + 1
            )
        elif s.severity.value == "warn":
            sig_warn_by_type[s.artifact_type_id] = sig_warn_by_type.get(s.artifact_type_id, 0) + 1

    critical_by_cat: dict[Category, set[str]] = {c: set() for c in CATEGORY_ORDER}
    for t in ARTIFACT_TYPES:
        if t.critical and t.category in critical_by_cat:
            critical_by_cat[t.category].add(t.id)

    cats: list[CategoryHealth] = []
    for cat in CATEGORY_ORDER:
        items = by_cat[cat]
        present = sum(1 for a in items if a.status == ArtifactStatus.APPROVED)
        draft = sum(1 for a in items if a.status != ArtifactStatus.APPROVED)
        have_types = {a.type_id for a in items}
        missing = len(critical_by_cat[cat] - have_types)

        blocker = 0
        warn = 0
        for a in items:
            blocker += sig_blocker_by_type.get(a.type_id, 0)
            warn += sig_warn_by_type.get(a.type_id, 0)

        cats.append(
            CategoryHealth(
                category=cat,
                label=CATEGORY_LABELS[cat],
                present=present,
                draft=draft,
                critical_missing=missing,
                blocker_signals=blocker,
                warn_signals=warn,
                health=_health(blocker, missing, warn, draft, present),
            )
        )

    return CompassSnapshot(
        project_id=project_id,
        categories=cats,
        overall=_overall(cats),
    )


def types_to_auto_regenerate(signals: list[Signal]) -> list[str]:
    """Pick artifact type ids that should be auto-rebuilt.

    Conservative: only stale-vs-corpus and broken-citation. We intentionally
    skip low-grounding/contradiction \u2014 those usually need human input,
    not a blind regenerate.

    Returns a stable, de-duplicated list (input order preserved).
    """
    out: list[str] = []
    seen: set[str] = set()
    for s in signals:
        if s.kind not in {"stale-vs-corpus", "broken-citation"}:
            continue
        if not s.artifact_type_id or s.artifact_type_id in seen:
            continue
        try:
            get_type(s.artifact_type_id)
        except KeyError:
            continue
        seen.add(s.artifact_type_id)
        out.append(s.artifact_type_id)
    return out
