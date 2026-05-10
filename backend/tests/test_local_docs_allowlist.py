"""Regression: validate_docs_path must refuse paths outside the
allowed roots even when the path exists. This closes the arbitrary
filesystem-read surface that previously exposed any directory the
backend process could read via /api/docs/scan."""

import pytest

from app.utils import local_docs


def test_validate_docs_path_refuses_outside_allowed_roots(tmp_path, monkeypatch):
    # Configure the allowed roots to a known sandbox directory.
    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()
    monkeypatch.setattr(
        local_docs, "_allowed_roots", lambda: [sandbox.resolve()]
    )
    # An attacker-controlled directory that exists but isn't under
    # any allowed root.
    rogue = tmp_path / "rogue"
    rogue.mkdir()
    with pytest.raises(ValueError, match="outside allowed roots"):
        local_docs.validate_docs_path(str(rogue))


def test_validate_docs_path_accepts_path_under_allowed_root(tmp_path, monkeypatch):
    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()
    nested = sandbox / "nested"
    nested.mkdir()
    monkeypatch.setattr(
        local_docs, "_allowed_roots", lambda: [sandbox.resolve()]
    )
    assert local_docs.validate_docs_path(str(nested)) == nested.resolve()


def test_validate_docs_path_accepts_the_root_itself(tmp_path, monkeypatch):
    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()
    monkeypatch.setattr(
        local_docs, "_allowed_roots", lambda: [sandbox.resolve()]
    )
    assert local_docs.validate_docs_path(str(sandbox)) == sandbox.resolve()
