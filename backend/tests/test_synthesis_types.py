"""Catalog invariants for ARTIFACT_TYPES.

Locks the v2.0 catalog at 42 types (33 baseline + 9 v2.0 additions) and
guards the v2.0 newcomers from accidental removal or critical-flag drift.
"""

from __future__ import annotations

from app.synthesis.categories import Category
from app.synthesis.types import ARTIFACT_TYPES, get_type

V2_NEW_IDS = {
    "interview-guide",
    "empathy-map",
    "jtbd",
    "emerging-themes",
    "root-cause",
    "assumption-matrix",
    "storyboard",
    "quick-win",
    "retro",
}


def test_catalog_size():
    assert len(ARTIFACT_TYPES) == 42


def test_ids_are_unique():
    ids = [t.id for t in ARTIFACT_TYPES]
    assert len(ids) == len(set(ids))


def test_v2_types_present():
    ids = {t.id for t in ARTIFACT_TYPES}
    assert V2_NEW_IDS.issubset(ids)


def test_only_quick_win_is_new_critical():
    new = [get_type(i) for i in V2_NEW_IDS]
    criticals = {t.id for t in new if t.critical}
    assert criticals == {"quick-win"}


def test_v2_categories_align_with_methodology():
    expected = {
        "interview-guide": Category.WHY,
        "empathy-map": Category.WHY,
        "jtbd": Category.WHY,
        "emerging-themes": Category.WHY,
        "root-cause": Category.WHY,
        "assumption-matrix": Category.SCOPE,
        "storyboard": Category.STORY,
        "quick-win": Category.WHAT,
        "retro": Category.OPERATIONAL,
    }
    for type_id, category in expected.items():
        assert get_type(type_id).category == category


def test_storyboard_has_image_fields():
    body = get_type("storyboard").body_schema
    assert "frames" in body
    assert "image_prompt" in body["frames"]
    assert "image_url" in body["frames"]


def test_v2_types_have_prompts_and_schemas():
    for type_id in V2_NEW_IDS:
        t = get_type(type_id)
        assert t.prompt.strip(), f"{type_id} missing prompt"
        assert t.body_schema, f"{type_id} missing body_schema"
        assert t.label.strip(), f"{type_id} missing label"
        assert t.description.strip(), f"{type_id} missing description"
