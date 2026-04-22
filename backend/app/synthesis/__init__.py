"""CORE synthesis engine.

Project-first intelligence layer that ingests broadly (vertex + local + Microsoft
Graph), generates a structured set of artifacts across the Design Thinking
modes, critiques them for grounding and completeness, and surfaces the
customer questions still worth asking.

Public surface:
    - ``Category`` / ``ArtifactType`` / ``ARTIFACT_TYPES`` (registry)
    - ``Corpus`` / ``SourceDoc`` (sources output)
    - ``Artifact`` / ``Citation`` / ``Critique`` / ``Question`` (models)
    - ``GeneratorEngine`` / ``CriticAgent`` / ``QuestionAgent`` (engines)

Storage collections owned by this module:
    - ``artifacts``        : generated artifacts (partition: project_id)
    - ``critiques``        : critic findings per artifact (partition: project_id)
    - ``synthesis_questions``: open customer questions (partition: project_id)
    - ``source_indexes``   : per-project source manifests (partition: project_id)
"""

from app.synthesis.categories import Category
from app.synthesis.models import Artifact, Citation, Critique, Question, SourceDoc
from app.synthesis.types import ARTIFACT_TYPES, ArtifactType, get_type

__all__ = [
    "ARTIFACT_TYPES",
    "Artifact",
    "ArtifactType",
    "Category",
    "Citation",
    "Critique",
    "Question",
    "SourceDoc",
    "get_type",
]
