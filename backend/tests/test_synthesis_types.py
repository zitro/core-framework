"""Assertions about the ArtifactType registry.

The registry is the source of truth for what synthesis can generate.
Every change to types.py should keep these invariants.
"""

from __future__ import annotations

import pytest

from app.synthesis.categories import CATEGORY_ORDER, Category
from app.synthesis.types import ARTIFACT_TYPES, ArtifactType


def test_registry_is_not_empty() -> None:
    assert len(ARTIFACT_TYPES) >= 1


def test_ids_are_unique() -> None:
    ids = [t.id for t in ARTIFACT_TYPES]
    assert len(set(ids)) == len(ids), "duplicate ArtifactType ids"


def test_ids_are_lowercase_kebab() -> None:
    """Slugs are used in URLs + filesystem paths; enforce safe shape."""
    for t in ARTIFACT_TYPES:
        assert t.id == t.id.lower(), f"id {t.id!r} not lowercase"
        assert " " not in t.id, f"id {t.id!r} contains whitespace"
        for ch in t.id:
            assert ch.isalnum() or ch == "-", f"id {t.id!r} has bad char {ch!r}"


def test_every_type_has_a_known_category() -> None:
    known = set(Category)
    for t in ARTIFACT_TYPES:
        assert t.category in known, f"{t.id} has unknown category {t.category!r}"


def test_every_category_has_at_least_one_type() -> None:
    seen: set[Category] = set()
    for t in ARTIFACT_TYPES:
        seen.add(t.category)
    missing = set(Category) - seen
    assert not missing, f"categories with no artifact types: {sorted(c.value for c in missing)}"


def test_category_order_covers_every_category() -> None:
    assert set(CATEGORY_ORDER) == set(Category)
    assert len(CATEGORY_ORDER) == len(set(CATEGORY_ORDER))


@pytest.mark.parametrize("t", ARTIFACT_TYPES, ids=lambda t: t.id)
def test_each_type_has_required_text_fields(t: ArtifactType) -> None:
    assert t.id, f"empty id on {t!r}"
    assert t.label, f"empty label on {t.id}"
    assert t.description, f"empty description on {t.id}"
    assert t.prompt, f"empty prompt on {t.id}"


@pytest.mark.parametrize("t", ARTIFACT_TYPES, ids=lambda t: t.id)
def test_body_schema_keys_are_strings(t: ArtifactType) -> None:
    """body_schema is a dict[str, str] hint shown to the LLM."""
    for k, v in t.body_schema.items():
        assert isinstance(k, str) and k, f"{t.id}: bad body_schema key {k!r}"
        assert isinstance(v, str), f"{t.id}.{k}: value not str"


def test_at_least_one_critical_type_per_category_that_has_them() -> None:
    """Critical types gate 'project complete' rollups. No regressions
    that accidentally drop all critical types in a category."""
    critical_categories: dict[Category, int] = {}
    for t in ARTIFACT_TYPES:
        if t.critical:
            critical_categories[t.category] = critical_categories.get(t.category, 0) + 1
    # At least one category must have a critical type (rollups need something to gate on).
    assert critical_categories, (
        "no critical ArtifactTypes — compass rollups have nothing to gate on"
    )
