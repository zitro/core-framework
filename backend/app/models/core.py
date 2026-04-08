from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(UTC)


class CorePhase(StrEnum):
    CAPTURE = "capture"
    ORIENT = "orient"
    REFINE = "refine"
    EXECUTE = "execute"


class DiscoveryMode(StrEnum):
    STANDARD = "standard"
    FDE = "fde"
    WORKSHOP_SPRINT = "workshop_sprint"


class ConfidenceLevel(StrEnum):
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
    created_at: datetime = Field(default_factory=_utcnow)


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


class QuickWin(BaseModel):
    id: str = ""
    title: str
    effort: str = "low"
    impact: str = "high"
    owner: str = ""
    done: bool = False


class Blocker(BaseModel):
    id: str = ""
    description: str
    severity: str = "major"
    mitigation: str = ""
    resolved: bool = False


class ExecuteData(BaseModel):
    quick_wins: list[QuickWin] = Field(default_factory=list)
    blockers: list[Blocker] = Field(default_factory=list)
    handoff_notes: str = ""


class Assumption(BaseModel):
    id: str = ""
    text: str
    risk: str = "medium"  # high, medium, low
    status: str = "untested"  # untested, validated, invalidated


class SolutionMatchData(BaseModel):
    problem: str = ""
    capabilities: list[str] = Field(default_factory=list)
    gap: str = ""
    confidence: float = 0


class DiscoveryUpdate(BaseModel):
    """Typed update payload — prevents arbitrary field injection."""

    name: str | None = None
    description: str | None = None
    mode: DiscoveryMode | None = None
    current_phase: CorePhase | None = None
    problem_statement: ProblemStatement | None = None
    execute_data: ExecuteData | None = None
    assumptions: list[Assumption] | None = None
    solution_matches: list[SolutionMatchData] | None = None


class Discovery(BaseModel):
    id: str = ""
    name: str
    description: str = ""
    mode: DiscoveryMode = DiscoveryMode.STANDARD
    current_phase: CorePhase = CorePhase.CAPTURE
    stakeholders: list[Stakeholder] = Field(default_factory=list)
    problem_statement: ProblemStatement | None = None
    execute_data: ExecuteData | None = None
    assumptions: list[Assumption] = Field(default_factory=list)
    solution_matches: list[SolutionMatchData] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Question(BaseModel):
    text: str
    purpose: str = ""
    follow_ups: list[str] = Field(default_factory=list)


class QuestionSet(BaseModel):
    id: str = ""
    discovery_id: str
    phase: CorePhase
    context: str = ""
    questions: list[Question] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)


class TranscriptInsight(BaseModel):
    text: str
    confidence: ConfidenceLevel = ConfidenceLevel.UNKNOWN
    phase: CorePhase = CorePhase.CAPTURE


class TranscriptAnalysis(BaseModel):
    id: str = ""
    discovery_id: str
    transcript_text: str
    insights: list[TranscriptInsight] = Field(default_factory=list)
    evidence_extracted: list[Evidence] = Field(default_factory=list)
    sentiment: str = ""
    key_themes: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)


class EvidenceUpdate(BaseModel):
    """Typed update payload for evidence items."""

    content: str | None = None
    source: str | None = None
    confidence: ConfidenceLevel | None = None
    tags: list[str] | None = None
