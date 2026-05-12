"""Tests for GitHub repository source materialization."""

from __future__ import annotations

import io
import json
from pathlib import Path
from zipfile import ZipFile

import pytest

from app.config import settings
from app.utils.repo_source import (
    RepoSourceError,
    ensure_github_repo_source,
    is_github_repo_url,
    normalize_github_repo_source,
)


class _FakeResponse:
    def __init__(self, payload: bytes):
        self._buffer = io.BytesIO(payload)

    def read(self, size: int = -1) -> bytes:
        return self._buffer.read(size)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def _zip_payload() -> bytes:
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as zf:
        zf.writestr(
            "repo-main/sample-project.md",
            "---\ntitle: Sample Project\ntype: initiative-overview\n---\n\ncontent",
        )
    return buffer.getvalue()


def test_is_github_repo_url() -> None:
    assert is_github_repo_url("https://github.com/octocat/Hello-World")
    assert is_github_repo_url("git@github.com:octocat/Hello-World.git")
    assert is_github_repo_url("github.com/octocat/Hello-World")
    assert not is_github_repo_url("https://example.com/org/repo")


def test_normalize_github_repo_source_formats() -> None:
    assert (
        normalize_github_repo_source("git@github.com:octocat/Hello-World.git")
        == "https://github.com/octocat/Hello-World"
    )
    assert (
        normalize_github_repo_source("ssh://git@github.com/octocat/Hello-World.git")
        == "https://github.com/octocat/Hello-World"
    )
    assert (
        normalize_github_repo_source("github.com/octocat/Hello-World")
        == "https://github.com/octocat/Hello-World"
    )


def test_ensure_github_repo_source_downloads_and_extracts(tmp_path: Path, monkeypatch) -> None:
    original_local_storage = settings.local_storage_path
    settings.local_storage_path = str(tmp_path)

    try:
        zip_bytes = _zip_payload()

        def fake_urlopen(req, timeout=0):  # noqa: ANN001
            url = req.full_url
            if url.endswith("/repos/octocat/Hello-World"):
                return _FakeResponse(json.dumps({"default_branch": "main"}).encode("utf-8"))
            if url.endswith("/repos/octocat/Hello-World/zipball"):
                return _FakeResponse(zip_bytes)
            if "/zipball/main" in url:
                return _FakeResponse(zip_bytes)
            raise AssertionError(f"Unexpected URL: {url}")

        monkeypatch.setattr("app.utils.repo_source_archive.urlopen", fake_urlopen)

        materialized = ensure_github_repo_source("https://github.com/octocat/Hello-World")

        assert materialized.is_dir()
        assert (materialized / "sample-project.md").is_file()
        assert (materialized / ".source.json").is_file()
    finally:
        settings.local_storage_path = original_local_storage


def test_ensure_github_repo_source_rejects_non_zip_payload(tmp_path: Path, monkeypatch) -> None:
    original_local_storage = settings.local_storage_path
    settings.local_storage_path = str(tmp_path)

    try:

        def fake_urlopen(req, timeout=0):  # noqa: ANN001
            url = req.full_url
            if url.endswith("/repos/octocat/Hello-World"):
                return _FakeResponse(json.dumps({"default_branch": "main"}).encode("utf-8"))
            return _FakeResponse(b"not-a-zip")

        monkeypatch.setattr("app.utils.repo_source_archive.urlopen", fake_urlopen)

        with pytest.raises(RepoSourceError):
            ensure_github_repo_source("https://github.com/octocat/Hello-World")
    finally:
        settings.local_storage_path = original_local_storage


def test_private_repo_message_mentions_auth(tmp_path: Path, monkeypatch) -> None:
    original_local_storage = settings.local_storage_path
    settings.local_storage_path = str(tmp_path)
    try:
        from urllib.error import HTTPError

        def fake_urlopen(req, timeout=0):  # noqa: ANN001
            raise HTTPError(req.full_url, 404, "Not Found", hdrs=None, fp=None)

        monkeypatch.setattr("app.utils.repo_source_archive.urlopen", fake_urlopen)

        with pytest.raises(RepoSourceError) as exc:
            ensure_github_repo_source("https://github.com/octocat/Hello-World")

        assert "GITHUB_TOKEN" in str(exc.value)
    finally:
        settings.local_storage_path = original_local_storage
