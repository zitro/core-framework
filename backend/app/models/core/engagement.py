from datetime import datetime

from pydantic import BaseModel, Field

from ._helpers import _utcnow
from .enums import EngagementStatus, ReviewStatus


class Engagement(BaseModel):
    """A customer project (a.k.a. engagement) that groups one or more discoveries.

    ``slug`` is the stable, URL- and filesystem-safe identifier used by the
    project switcher, the ``/data/projects/<slug>`` mount convention, and
    (in v1.2+) the Cosmos partition key. Auto-derived from ``name`` on create
    if not provided.
    """

    id: str = ""
    slug: str = ""
    name: str
    customer: str = ""
    industry: str = ""
    summary: str = ""
    status: EngagementStatus = EngagementStatus.PROPOSED
    repo_path: str = ""
    discovery_ids: list[str] = Field(default_factory=list)
    owners: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    created_by: str = ""
    updated_by: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class EngagementUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    customer: str | None = None
    industry: str | None = None
    summary: str | None = None
    status: EngagementStatus | None = None
    repo_path: str | None = None
    discovery_ids: list[str] | None = None
    owners: list[str] | None = None
    tags: list[str] | None = None


class Review(BaseModel):
    """Human-in-the-loop review of any artifact (collection + item_id)."""

    id: str = ""
    project_id: str = ""
    discovery_id: str = ""
    artifact_collection: str
    artifact_id: str
    artifact_title: str = ""
    status: ReviewStatus = ReviewStatus.PENDING
    requested_by: str = ""
    reviewer: str = ""
    comment: str = ""
    created_by: str = ""
    updated_by: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    decided_at: datetime | None = None


class ReviewDecision(BaseModel):
    status: ReviewStatus
    reviewer: str = ""
    comment: str = ""
