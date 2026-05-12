from datetime import datetime

from pydantic import BaseModel, Field

from ._helpers import _utcnow
from .enums import ConfidenceLevel, CorePhase
from .evidence import Evidence


class Question(BaseModel):
    text: str
    purpose: str = ""
    follow_ups: list[str] = Field(default_factory=list)


class QuestionGroundingSource(BaseModel):
    query: str = ""
    title: str = ""
    url: str = ""
    snippet: str = ""
    source: str = ""


class QuestionSet(BaseModel):
    id: str = ""
    project_id: str = ""
    discovery_id: str
    phase: CorePhase
    context: str = ""
    questions: list[Question] = Field(default_factory=list)
    grounding_sources: list[QuestionGroundingSource] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)


class TranscriptInsight(BaseModel):
    text: str
    confidence: ConfidenceLevel = ConfidenceLevel.UNKNOWN
    phase: CorePhase = CorePhase.CAPTURE


class TranscriptAnalysis(BaseModel):
    id: str = ""
    project_id: str = ""
    discovery_id: str
    transcript_text: str
    insights: list[TranscriptInsight] = Field(default_factory=list)
    evidence_extracted: list[Evidence] = Field(default_factory=list)
    sentiment: str = ""
    key_themes: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)
