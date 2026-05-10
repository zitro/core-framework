"""Regression: write_classified_content must reject any input that
would resolve outside the supplied content_dir. The previous code
joined user-controlled `directory` and `filename` directly with the
base path — `directory="../../etc"` could write arbitrary files."""

from pathlib import Path

import pytest

from app.utils.ingest import _sanitize_segment, write_classified_content


def test_sanitize_segment_rejects_absolute_path():
    with pytest.raises(ValueError, match="relative path"):
        _sanitize_segment("/etc/passwd", label="filename")


def test_sanitize_segment_rejects_parent_traversal():
    with pytest.raises(ValueError, match="path-traversal"):
        _sanitize_segment("../escape", label="directory")


def test_sanitize_segment_rejects_nested_traversal():
    with pytest.raises(ValueError, match="path-traversal"):
        _sanitize_segment("inner/../../escape", label="directory")


def test_sanitize_segment_accepts_clean_relative_path():
    assert _sanitize_segment("foo/bar", label="directory") == "foo/bar"


def test_sanitize_segment_accepts_simple_filename():
    assert _sanitize_segment("notes.md", label="filename") == "notes.md"


def test_write_classified_content_refuses_traversal_directory(tmp_path):
    content_dir = tmp_path / "repo"
    content_dir.mkdir()
    with pytest.raises(ValueError, match="path-traversal"):
        write_classified_content(
            content_dir=str(content_dir),
            directory="../escape",
            filename="x.md",
            content="hi",
        )


def test_write_classified_content_refuses_traversal_filename(tmp_path):
    content_dir = tmp_path / "repo"
    content_dir.mkdir()
    with pytest.raises(ValueError, match="path-traversal"):
        write_classified_content(
            content_dir=str(content_dir),
            directory="ok",
            filename="../../etc/passwd",
            content="hi",
        )


def test_write_classified_content_refuses_absolute_filename(tmp_path):
    content_dir = tmp_path / "repo"
    content_dir.mkdir()
    with pytest.raises(ValueError, match="relative path"):
        write_classified_content(
            content_dir=str(content_dir),
            directory="",
            filename="/tmp/x.md",
            content="hi",
        )


def test_write_classified_content_clean_path_succeeds(tmp_path):
    content_dir = tmp_path / "repo"
    content_dir.mkdir()
    res = write_classified_content(
        content_dir=str(content_dir),
        directory="notes",
        filename="capture.md",
        content="hello",
    )
    assert "error" not in res
    written = Path(res["full_path"])
    assert written.read_text() == "hello"
    assert res["path"] == "notes/capture.md"
