from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class CorePhase(str, Enum):
    CAPTURE = "capture"
    ORIENT = "orient"
    REFINE = "refine"
    EXECUTE = "execute"


class DiscoveryMode(str, Enum):
    STANDARD = "standard"
    FDE = "fde"
    WORKSHOP_SPRINT = "workshop_sprint"


class ConfidenceLevel(str, Enum):
    VALIDATED = "validated"
    ASSUMED = "assumed"
    UNKNOWN = "unknown"
    CONFLICTING = "conflicting"


class Evidence(BaseModel):
    id: str = ""
    discovery_id: str = ""
    phase: CorePhase
    content: str
    source: str = ""
    confidence: ConfidenceLevel = ConfidenceLevel.UNKNOWN
    tags: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Stakeholder(BaseModel):
    name: str
    role: str
    influence: str = ""  # high, medium, low
    notes: str = ""


class ProblemStatement(BaseModel):
    who: str = ""
    what: str = ""
    why: str = ""
    impact: str = ""
    statement: str = ""
    confidence: ConfidenceLevel = ConfidenceLevel.UNKNOWN


class Discovery(BaseModel):
    id: str = ""
    name: str
    description: str = ""
    mode: DiscoveryMode = DiscoveryMode.STANDARD
    current_phase: CorePhase = CorePhase.CAPTURE
    stakeholders: list[Stakeholder] = Field(default_factory=list)
    problem_statement: ProblemStatement | None = None
    evidence: list[Evidence] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class QuestionSet(BaseModel):
    id: str = ""
    discovery_id: str
    phase: CorePhase
    context: str = ""
    questions: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TranscriptAnalysis(BaseModel):
    id: str = ""
    discovery_id: str
    transcript_text: str
    insights: list[dict] = Field(default_factory=list)
    evidence_extracted: list[Evidence] = Field(default_factory=list)
    sentiment: str = ""
    key_themes: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
