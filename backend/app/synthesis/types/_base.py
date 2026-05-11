"""ArtifactType dataclass — single source of truth for the registry shape."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.synthesis.categories import Category


@dataclass(frozen=True)
class ArtifactType:
    id: str
    category: Category
    label: str
    description: str
    # JSON-schema-ish hint shown to the LLM. Keys are body fields, values are
    # short descriptions of what that field should contain.
    body_schema: dict[str, str] = field(default_factory=dict)
    # Prompt fragment appended after the shared system frame.
    prompt: str = ""
    # Critical types must exist for a project to be considered "complete".
    critical: bool = False
