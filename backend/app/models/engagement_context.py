"""Engagement Context — typed schema (v2.2).

The single source of truth for "what is this engagement about". One row
per Project (FK ``project_id``). Captured in /capture, displayed in
/orient as the engagement brief, used as grounding context for every AI
call (artifact generation, per-card chat, push-to-vertex justification).

Auto-projected to ``engagement-brief.md`` inside the writable vertex
Source on every save, so the markdown stays in sync with the typed
record. The DB row is canonical; the .md is a derived artifact for
human readers and offline access.
"""

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(UTC)


class EngagementPhase(StrEnum):
    DISCOVERY = "discovery"
    PILOT = "pilot"
    BUILD = "build"
    OPERATE = "operate"


class EngagementStakeholder(BaseModel):
    name: str
    role: str = ""
    org: str = ""  # internal | customer | partner
    influence: str = ""  # high | medium | low
    notes: str = ""


class EngagementMetric(BaseModel):
    name: str
    target: str = ""
    baseline: str = ""
    notes: str = ""


class EngagementMilestone(BaseModel):
    label: str
    target_date: str = ""  # ISO date or freeform
    notes: str = ""


class EngagementContext(BaseModel):
    """Typed engagement brief; one per project."""

    id: str = ""
    project_id: str  # FK to Engagement
    customer_id: str = ""  # FK to Customer (denormalized for grounding speed)
    # Headline
    title: str = ""
    one_liner: str = ""
    phase: EngagementPhase = EngagementPhase.DISCOVERY
    # The work
    problem: str = ""  # the problem we are solving
    desired_outcome: str = ""  # what success looks like
    scope_in: list[str] = Field(default_factory=list)
    scope_out: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    # The people
    stakeholders: list[EngagementStakeholder] = Field(default_factory=list)
    # The path
    success_metrics: list[EngagementMetric] = Field(default_factory=list)
    milestones: list[EngagementMilestone] = Field(default_factory=list)
    # Free-form
    notes: str = ""
    # Audit
    created_by: str = ""
    updated_by: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class EngagementContextUpdate(BaseModel):
    """Typed partial update — every field optional."""

    title: str | None = None
    one_liner: str | None = None
    phase: EngagementPhase | None = None
    problem: str | None = None
    desired_outcome: str | None = None
    scope_in: list[str] | None = None
    scope_out: list[str] | None = None
    constraints: list[str] | None = None
    assumptions: list[str] | None = None
    risks: list[str] | None = None
    stakeholders: list[EngagementStakeholder] | None = None
    success_metrics: list[EngagementMetric] | None = None
    milestones: list[EngagementMilestone] | None = None
    notes: str | None = None
