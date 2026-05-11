"""Artifact-type registry.

Each ``ArtifactType`` describes one thing the generator knows how to produce:
its category, a human label, the JSON shape its ``body`` will fill, and a
generation prompt fragment. The full prompt is assembled in ``prompts.py``
from this fragment + a shared system frame + the corpus + critic feedback.

Adding a new artifact type = appending one entry to the appropriate
per-category module (``_why.py``, ``_value.py``, etc.). This package
concatenates them in ``CATEGORY_ORDER`` so import order is deterministic.
"""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types._base import ArtifactType
from app.synthesis.types._why import WHY_TYPES
from app.synthesis.types._value import VALUE_TYPES
from app.synthesis.types._what import WHAT_TYPES
from app.synthesis.types._scope import SCOPE_TYPES
from app.synthesis.types._how import HOW_TYPES
from app.synthesis.types._story import STORY_TYPES
from app.synthesis.types._operational import OPERATIONAL_TYPES


ARTIFACT_TYPES: list[ArtifactType] = (
    WHY_TYPES
    +    VALUE_TYPES
    +    WHAT_TYPES
    +    SCOPE_TYPES
    +    HOW_TYPES
    +    STORY_TYPES
    +    OPERATIONAL_TYPES
)


def get_type(type_id: str) -> ArtifactType:
    for t in ARTIFACT_TYPES:
        if t.id == type_id:
            return t
    raise KeyError(f"Unknown ArtifactType id {type_id!r}")


def types_for_category(category: Category) -> list[ArtifactType]:
    return [t for t in ARTIFACT_TYPES if t.category == category]
