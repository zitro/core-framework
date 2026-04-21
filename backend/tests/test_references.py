"""Tests for the auto-generated references index."""

from pathlib import Path

from app.utils.references import regenerate_references


def _write(p: Path, body: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


def test_regenerate_with_no_content(tmp_path: Path):
    out = regenerate_references(tmp_path)
    assert out["count"] == 0
    text = (tmp_path / "references.md").read_text(encoding="utf-8")
    assert "# References" in text
    assert "_No content yet._" in text


def test_regenerate_collects_frontmatter(tmp_path: Path):
    _write(
        tmp_path / "decisions" / "alpha.md",
        (
            '---\ntitle: "Alpha Decision"\ndate: 2025-01-02\n'
            "type: decision\nsource: meeting\n---\n\nbody"
        ),
    )
    _write(
        tmp_path / "notes" / "beta.md",
        "---\ntitle: Beta Notes\ntype: note\n---\n\nbody",
    )
    _write(tmp_path / "_skipme.md", "skip")
    _write(tmp_path / "README.md", "skip")

    out = regenerate_references(tmp_path)
    assert out["count"] == 2

    text = (tmp_path / "references.md").read_text(encoding="utf-8")
    assert "Alpha Decision" in text
    assert "Beta Notes" in text
    assert "decisions/alpha.md" in text
    assert "_skipme" not in text


def test_regenerate_returns_error_for_missing_dir(tmp_path: Path):
    out = regenerate_references(tmp_path / "does-not-exist")
    assert "error" in out


def test_existing_references_excluded_from_index(tmp_path: Path):
    _write(tmp_path / "x.md", "---\ntitle: X\n---\n")
    regenerate_references(tmp_path)
    # Second pass should still report 1 (not include references.md itself)
    out = regenerate_references(tmp_path)
    assert out["count"] == 1
