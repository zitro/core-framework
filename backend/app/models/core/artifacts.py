from datetime import datetime

from pydantic import BaseModel, Field

from ._helpers import _utcnow


class ProblemStatementVersion(BaseModel):
    id: str = ""
    project_id: str = ""
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


class ContextBriefVersion(BaseModel):
    id: str = ""
    project_id: str = ""
    discovery_id: str
    version: int = 1
    title: str = ""
    summary: str = ""
    goals: list[str] = Field(default_factory=list)
    stakeholders: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    evidence_summary: str = ""
    user_instructions: str = ""
    context_used: str = ""
    context_fingerprint: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class UseCaseVersion(BaseModel):
    id: str = ""
    project_id: str = ""
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
    project_id: str = ""
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
