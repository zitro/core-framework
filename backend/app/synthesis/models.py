"""Pydantic models shared across the synthesis subsystem."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from app.synthesis.categories import Category


def _utcnow() -> datetime:
    return datetime.now(UTC)


# ── sources ─────────────────────────────────────────────────────────────


class SourceKind(StrEnum):
    VERTEX = "vertex"
    LOCAL_DIR = "local_dir"
    MS_GRAPH_FILE = "ms_graph_file"
    MS_GRAPH_MAIL = "ms_graph_mail"
    MS_GRAPH_MEETING = "ms_graph_meeting"
    GITHUB = "github"
    WEB = "web"
    HTTP_JSON = "http_json"


class SourceDoc(BaseModel):
    """A single piece of corpus content with provenance."""

    id: str  # stable per-corpus id (e.g. "vertex:overview", "local:notes/x.md")
    kind: SourceKind
    title: str
    uri: str = ""  # absolute path / URL when available
    snippet: str = ""  # short representative excerpt
    text: str = ""  # full text used for grounding
    last_modified: str = ""  # ISO8601, best-effort
    metadata: dict = Field(default_factory=dict)


class Corpus(BaseModel):
    """All sources we know about for a project at a point in time."""

    project_id: str
    docs: list[SourceDoc] = Field(default_factory=list)
    built_at: datetime = Field(default_factory=_utcnow)

    def by_id(self, doc_id: str) -> SourceDoc | None:
        for d in self.docs:
            if d.id == doc_id:
                return d
        return None


# ── artifacts ──────────────────────────────────────────────────────────


class Citation(BaseModel):
    """Pointer from an artifact claim back to a corpus document."""

    source_id: str
    quote: str = ""  # short verbatim excerpt that supports the claim
    note: str = ""  # optional reasoning / paraphrase


class ArtifactStatus(StrEnum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"


class Artifact(BaseModel):
    """A generated artifact owned by a project."""

    id: str = ""
    project_id: str
    type_id: str  # ArtifactType.id
    category: Category
    title: str
    summary: str = ""  # 1–3 sentence executive summary
    body: dict = Field(default_factory=dict)  # type-specific structured payload
    citations: list[Citation] = Field(default_factory=list)
    status: ArtifactStatus = ArtifactStatus.DRAFT
    version: int = 1
    generated_by: str = "synthesis.generator"
    model: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class ArtifactCreate(BaseModel):
    """Input for the regenerate endpoint."""

    type_id: str
    instructions: str = ""


# ── critiques ──────────────────────────────────────────────────────────


class IssueSeverity(StrEnum):
    INFO = "info"
    WARN = "warn"
    BLOCKER = "blocker"


class CritiqueIssue(BaseModel):
    severity: IssueSeverity
    dimension: str  # grounding | completeness | clarity | contradiction
    message: str
    field: str = ""  # body field path when known


class Critique(BaseModel):
    id: str = ""
    project_id: str
    artifact_id: str
    artifact_type_id: str
    score: float = 0.0  # 0.0–1.0 overall confidence
    issues: list[CritiqueIssue] = Field(default_factory=list)
    model: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


# ── questions ──────────────────────────────────────────────────────────


class Question(BaseModel):
    """A question worth asking the customer to fill a gap in the corpus."""

    id: str = ""
    project_id: str
    text: str
    rationale: str = ""
    target_artifact_type_id: str = ""  # which artifact this would unblock
    priority: int = 3  # 1 = ask first, 5 = nice-to-have
    answered: bool = False
    answer: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
