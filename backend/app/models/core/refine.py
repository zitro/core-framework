from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from ._helpers import _normalize_confidence, _utcnow


class RefineAgentDefinition(BaseModel):
    id: str
    title: str
    role: str
    mission: str
    goal: str = ""
    review_lens: list[str] = Field(default_factory=list)
    expected_outputs: list[str] = Field(default_factory=list)
    signature_questions: list[str] = Field(default_factory=list)
    work_item_focus: list[str] = Field(default_factory=list)


class RefineAgentArtifact(BaseModel):
    title: str = ""
    content: str = ""
    bullets: list[str] = Field(default_factory=list)


class RefineWorkItem(BaseModel):
    title: str = ""
    owner_role: str = ""
    priority: str = "medium"
    rationale: str = ""
    next_step: str = ""


class RefineAgentOpinion(BaseModel):
    agent_id: str
    role: str = ""
    title: str = ""
    position: str = ""
    confidence: int = 0
    strengths: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    work_items: list[RefineWorkItem] = Field(default_factory=list)
    artifact: RefineAgentArtifact = Field(default_factory=RefineAgentArtifact)

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, value):
        return _normalize_confidence(value)


class RefineRoundtableTurn(BaseModel):
    phase: str = ""
    speaker_id: str = ""
    speaker: str = ""
    message: str = ""
    responds_to: str = ""
    decision_impact: str = ""


class RefineSolutionOption(BaseModel):
    title: str = ""
    value: str = ""
    effort: str = ""
    risk: str = ""
    evidence_fit: str = ""
    tradeoffs: list[str] = Field(default_factory=list)


class RefineSynthesis(BaseModel):
    consensus: list[str] = Field(default_factory=list)
    disagreements: list[str] = Field(default_factory=list)
    recommended_direction: str = ""
    solution_options: list[RefineSolutionOption] = Field(default_factory=list)
    validation_plan: list[str] = Field(default_factory=list)
    execute_readiness: str = ""
    decision_gate: str = "needs_validation"
    confidence: int = 0

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, value):
        return _normalize_confidence(value)


class RefineReview(BaseModel):
    id: str = ""
    project_id: str = ""
    discovery_id: str
    version: int = 1
    parent_review_id: str = ""
    trigger_source: str = "manual"
    agent_ids: list[str] = Field(default_factory=list)
    opinions: list[RefineAgentOpinion] = Field(default_factory=list)
    roundtable: list[RefineRoundtableTurn] = Field(default_factory=list)
    synthesis: RefineSynthesis = Field(default_factory=RefineSynthesis)
    user_instructions: str = ""
    context_used: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class RefineChatMessage(BaseModel):
    id: str = ""
    project_id: str = ""
    discovery_id: str
    thread_type: str = "group"
    agent_id: str = ""
    speaker_id: str = "user"
    speaker: str = "User"
    role: str = "user"
    content: str
    contribution_type: str = ""
    review_version: int = 0
    created_at: datetime = Field(default_factory=_utcnow)
