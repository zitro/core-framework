"""Tests for the migration chain runner."""

from __future__ import annotations

import pytest

from app.migrations import MigrationGapError, _semver_key, run_migrator_chain


def test_semver_key_strips_prerelease_and_build():
    assert _semver_key("1.0.0") == (1, 0, 0)
    assert _semver_key("1.2.3-rc1") == (1, 2, 3)
    assert _semver_key("1.2.3+build.4") == (1, 2, 3)
    assert _semver_key("1.2.3-rc1+build.4") == (1, 2, 3)


def test_semver_key_rejects_malformed():
    with pytest.raises(ValueError):
        _semver_key("1.2")
    with pytest.raises(ValueError):
        _semver_key("not.a.version")


def test_same_version_returns_deep_copy():
    raw = {"schema_version": "1.0.0", "x": [1, 2]}
    out = run_migrator_chain(raw, kind="core_discovery_marker", from_="1.0.0", to="1.0.0")
    assert out == raw
    assert out is not raw
    assert out["x"] is not raw["x"]


def test_unknown_kind_raises():
    # Same-version is a no-op (early return) and doesn't validate the
    # kind. Use distinct versions so the kind check actually fires.
    with pytest.raises(ValueError, match="unknown migration kind"):
        run_migrator_chain({}, kind="not_a_real_kind", from_="1.0.0", to="2.0.0")


def test_from_newer_than_to_raises_migration_gap():
    with pytest.raises(MigrationGapError):
        run_migrator_chain({}, kind="core_discovery_marker", from_="2.0.0", to="1.0.0")


def test_no_chain_to_unsupported_version_raises():
    # core_discovery_marker has only the baseline migrator; no chain
    # exists from 1.0.0 -> 2.0.0 yet.
    with pytest.raises(MigrationGapError):
        run_migrator_chain(
            {"schema_version": "1.0.0"},
            kind="core_discovery_marker",
            from_="1.0.0",
            to="2.0.0",
        )
