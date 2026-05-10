"""Regression: _safe_extractall must refuse zip members whose
resolved path would escape the extraction directory (zip-slip). The
previous code called ZipFile.extractall directly on archives fetched
from GitHub, which a poisoned repository archive could exploit to
write outside extract_dir."""

import io
import zipfile

import pytest

from app.utils.repo_source import RepoSourceError, _safe_extractall


def _zip_with_member(name: str, data: bytes = b"x") -> zipfile.ZipFile:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(name, data)
    buf.seek(0)
    return zipfile.ZipFile(buf, "r")


def test_safe_extractall_refuses_parent_traversal(tmp_path):
    extract_dir = tmp_path / "extract"
    extract_dir.mkdir()
    with _zip_with_member("../escape.txt") as zf:
        with pytest.raises(RepoSourceError, match="outside target directory"):
            _safe_extractall(zf, extract_dir)
    # Sibling file must not have been written.
    assert not (tmp_path / "escape.txt").exists()


def test_safe_extractall_refuses_absolute_member(tmp_path):
    extract_dir = tmp_path / "extract"
    extract_dir.mkdir()
    # ZipFile permits "/tmp/x" as a member name even though it's
    # nonsense for portable archives; resolve() against base should
    # land outside.
    with _zip_with_member("/abs/escape.txt") as zf:
        with pytest.raises(RepoSourceError, match="outside target directory"):
            _safe_extractall(zf, extract_dir)


def test_safe_extractall_accepts_clean_archive(tmp_path):
    extract_dir = tmp_path / "extract"
    extract_dir.mkdir()
    with _zip_with_member("nested/dir/file.txt", b"hello") as zf:
        _safe_extractall(zf, extract_dir)
    extracted = extract_dir / "nested" / "dir" / "file.txt"
    assert extracted.read_bytes() == b"hello"


def test_safe_extractall_refuses_symlink_member(tmp_path):
    extract_dir = tmp_path / "extract"
    extract_dir.mkdir()
    # Hand-craft a symlink member via external_attr.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        info = zipfile.ZipInfo("link")
        info.external_attr = 0xA1ED0000  # 0xA000 << 16 | 0o755 << 16-ish
        zf.writestr(info, "/etc/passwd")
    buf.seek(0)
    with zipfile.ZipFile(buf, "r") as opened:
        with pytest.raises(RepoSourceError, match="symlink"):
            _safe_extractall(opened, extract_dir)
    assert not (extract_dir / "link").exists()
