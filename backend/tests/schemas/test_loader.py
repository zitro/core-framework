"""Tests for load_with_migrations + the incompatibility registry."""

from __future__ import annotations

import json

import pytest

from app.schemas import incompatibility
from app.schemas.core_discovery_marker import CoreDiscoveryMarker
from app.schemas.loader import SchemaLoadError, load_with_migrations


@pytest.fixture(autouse=True)
def _clear_registry():
    incompatibility.clear()
    yield
    incompatibility.clear()


def _write_marker(path, **overrides):
    payload = {
        "schema_version": "1.0.0",
        "customer_slug": "acme",
        "display_name": "Acme",
        "cli_version_created": "1.3.1",
        "framework_version_pinned": "1.3.1",
        "created_at": "2026-05-10T00:00:00Z",
        "files_managed": [],
    }
    payload.update(overrides)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_load_valid_marker(tmp_path):
    f = _write_marker(tmp_path / "core-discovery.json")
    marker = load_with_migrations(f, schema=CoreDiscoveryMarker, kind="core_discovery_marker")
    assert marker.customer_slug == "acme"
    assert marker.display_name == "Acme"
    assert incompatibility.snapshot() == {}


def test_load_missing_file_raises(tmp_path):
    with pytest.raises(SchemaLoadError, match="not found"):
        load_with_migrations(
            tmp_path / "missing.json",
            schema=CoreDiscoveryMarker,
            kind="core_discovery_marker",
        )
    # Missing file is NOT recorded as an incompatibility — it's
    # absence, not a malformed file.
    assert incompatibility.snapshot() == {}


def test_invalid_json_records_incompatibility(tmp_path):
    f = tmp_path / "bad.json"
    f.write_text("{not json", encoding="utf-8")
    with pytest.raises(SchemaLoadError):
        load_with_migrations(f, schema=CoreDiscoveryMarker, kind="core_discovery_marker")
    snap = incompatibility.snapshot()
    assert "core_discovery_marker" in snap
    assert snap["core_discovery_marker"][0]["path"] == str(f)
    assert snap["core_discovery_marker"][0]["file_version"] == "<unreadable>"


def test_validation_failure_records_incompatibility(tmp_path):
    # Floating tag in framework_version_pinned — the Pydantic
    # validator rejects.
    f = _write_marker(tmp_path / "marker.json", framework_version_pinned="latest")
    with pytest.raises(SchemaLoadError, match="validation"):
        load_with_migrations(f, schema=CoreDiscoveryMarker, kind="core_discovery_marker")
    snap = incompatibility.snapshot()
    assert "core_discovery_marker" in snap
    assert "framework_version_pinned" in snap["core_discovery_marker"][0]["reason"]


def test_unknown_kind_raises_before_io(tmp_path):
    f = _write_marker(tmp_path / "ok.json")
    with pytest.raises(ValueError, match="unknown schema kind"):
        load_with_migrations(f, schema=CoreDiscoveryMarker, kind="not_real")


def test_implicit_baseline_when_schema_version_missing(tmp_path):
    # Same payload but with schema_version stripped — loader should
    # treat it as 1.0.0 per the implicit-baseline rule.
    payload = {
        "customer_slug": "acme",
        "display_name": "Acme",
        "cli_version_created": "1.3.1",
        "framework_version_pinned": "1.3.1",
        "created_at": "2026-05-10T00:00:00Z",
        "files_managed": [],
    }
    f = tmp_path / "marker.json"
    f.write_text(json.dumps(payload), encoding="utf-8")
    marker = load_with_migrations(f, schema=CoreDiscoveryMarker, kind="core_discovery_marker")
    assert marker.schema_version == "1.0.0"
