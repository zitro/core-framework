from datetime import datetime

from pydantic import BaseModel, Field

from ._helpers import _utcnow
from .enums import ConfidenceLevel, CorePhase, DiscoveryMode, EngagementSourceType
from .evidence import Evidence


class Stakeholder(BaseModel):
    name: str
    role: str
    influence: str = ""
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


class ExecuteOutputVersion(BaseModel):
    id: str = ""
    project_id: str = ""
    discovery_id: str
    output_id: str
    title: str = ""
    description: str = ""
    audience: str = "executive"
    style: str = "brief"
    category: str = "stakeholder"
    version: int = 1
    headline: str = ""
    summary: str = ""
    sections: list[dict[str, str]] = Field(default_factory=list)
    focus: str = ""
    context_fingerprint: str = ""
    context_used: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class Assumption(BaseModel):
    id: str = ""
    text: str
    risk: str = "medium"
    status: str = "untested"
    certainty: str = "unknown"
    evidence: str = ""
    validation_method: str = ""
    owner: str = ""
    impact_if_wrong: str = ""


class SolutionMatchData(BaseModel):
    problem: str = ""
    capabilities: list[str] = Field(default_factory=list)
    gap: str = ""
    confidence: float = 0


class TechnologyTarget(BaseModel):
    name: str
    focus: str = ""


class EngagementSource(BaseModel):
    type: EngagementSourceType = EngagementSourceType.LOCAL_FOLDER
    value: str


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
    target_technologies: list[TechnologyTarget] | None = None
    engagement_repo_path: str | None = None
    engagement_repo_paths: list[str] | None = None
    engagement_sources: list[EngagementSource] | None = None
    project_id: str | None = None


class Discovery(BaseModel):
    id: str = ""
    project_id: str = ""
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
    solution_providers: list[str] = Field(default_factory=list)
    target_technologies: list[TechnologyTarget] = Field(default_factory=list)
    engagement_repo_path: str = ""
    engagement_repo_paths: list[str] = Field(default_factory=list)
    engagement_sources: list[EngagementSource] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    created_by: str = ""
    updated_by: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
