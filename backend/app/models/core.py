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


class EvidenceType(StrEnum):
    """Design-thinking-aligned evidence taxonomy.

    `GENERAL` is the legacy default for items captured before the taxonomy
    existed. New items should pick a specific type.
    """

    GENERAL = "general"
    OBSERVATION = "observation"  # something we watched happen
    QUOTE = "quote"  # verbatim from a stakeholder
    PAIN_POINT = "pain_point"  # named friction in the current state
    JTBD = "jtbd"  # job-to-be-done statement
    ASSUMPTION = "assumption"  # belief we hold but have not validated
    HYPOTHESIS = "hypothesis"  # testable prediction
    INSIGHT = "insight"  # synthesized takeaway across other evidence


class Evidence(BaseModel):
    id: str = ""
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
    docs_path: str | None = None
    solution_providers: list[str] | None = None
    engagement_repo_path: str | None = None


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
    docs_path: str = ""
    solution_providers: list[str] = Field(default_factory=lambda: ["Microsoft Azure"])
    engagement_repo_path: str = ""
    evidence: list[Evidence] = Field(default_factory=list)
    created_by: str = ""
    updated_by: str = ""
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


class ProblemStatementVersion(BaseModel):
    id: str = ""
    discovery_id: str
    version: int = 1
    who: str = ""
    what: str = ""
    why: str = ""
    impact: str = ""
    statement: str = ""
    user_instructions: str = ""
    context_used: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class EvidenceUpdate(BaseModel):
    """Typed update payload for evidence items."""

    content: str | None = None
    source: str | None = None
    confidence: ConfidenceLevel | None = None
    evidence_type: EvidenceType | None = None
    tags: list[str] | None = None


# ── AI Advisor artifacts ─────────────────────────────────


class UseCaseVersion(BaseModel):
    id: str = ""
    discovery_id: str
    version: int = 1
    title: str = ""
    persona: str = ""
    goal: str = ""
    current_state: str = ""
    desired_state: str = ""
    business_value: str = ""
    business_impact: str = ""
    success_metrics: list[str] = Field(default_factory=list)
    summary: str = ""
    user_instructions: str = ""
    context_used: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class ServiceRecommendation(BaseModel):
    service: str
    purpose: str = ""
    rationale: str = ""


class SolutionBlueprint(BaseModel):
    id: str = ""
    discovery_id: str
    version: int = 1
    approach_title: str = ""
    approach_summary: str = ""
    services: list[ServiceRecommendation] = Field(default_factory=list)
    architecture_overview: str = ""
    quick_win_suggestion: str = ""
    estimated_effort: str = ""
    open_questions: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    target_providers: list[str] = Field(default_factory=list)
    user_instructions: str = ""
    context_used: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


# ── FDE workflow ─────────────────────────────────────────


class EngagementStatus(StrEnum):
    PROPOSED = "proposed"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


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


class ReviewStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"


class Review(BaseModel):
    """Human-in-the-loop review of any artifact (collection + item_id)."""

    id: str = ""
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
