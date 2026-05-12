from datetime import datetime

from pydantic import BaseModel, Field

from ._helpers import _utcnow
from .enums import ConfidenceLevel, CorePhase, EvidenceType


class Evidence(BaseModel):
    id: str = ""
    project_id: str = ""
    discovery_id: str = ""
    phase: CorePhase
    content: str
    source: str = ""
    confidence: ConfidenceLevel = ConfidenceLevel.UNKNOWN
    evidence_type: EvidenceType = EvidenceType.GENERAL
    tags: list[str] = Field(default_factory=list)
    created_by: str = ""
    updated_by: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class EvidenceUpdate(BaseModel):
    """Typed update payload for evidence items."""

    content: str | None = None
    source: str | None = None
    confidence: ConfidenceLevel | None = None
    evidence_type: EvidenceType | None = None
    tags: list[str] | None = None
