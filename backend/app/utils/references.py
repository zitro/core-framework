"""Auto-generate a `references.md` index for an engagement repo.

Walks the content directory, reads frontmatter from every markdown file,
and writes a flat index listing source, type, date, and a relative link.
Called automatically after each `write_classified_content` so the index
stays in sync.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from pathlib import Path

logger = logging.getLogger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)
_REFERENCES_FILENAME = "references.md"


def _parse_frontmatter(text: str) -> dict[str, str]:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}
    fm: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        fm[key.strip()] = value.strip().strip('"').strip("'")
    return fm


def _collect_entries(content_dir: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for md_file in sorted(content_dir.rglob("*.md")):
        if md_file.name == _REFERENCES_FILENAME:
            continue
        if md_file.name.startswith("_") or md_file.name == "README.md":
            continue
        try:
            text = md_file.read_text(encoding="utf-8", errors="ignore")[:4000]
        except OSError:
            continue
        fm = _parse_frontmatter(text)
        rel = md_file.relative_to(content_dir).as_posix()
        entries.append(
            {
                "path": rel,
                "title": fm.get("title", md_file.stem),
                "type": fm.get("type", ""),
                "date": fm.get("date", ""),
                "source": fm.get("source", ""),
            }
        )
    return entries


def _render(entries: list[dict[str, str]]) -> str:
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    lines: list[str] = [
        "---",
        'title: "References"',
        f"date: {today}",
        "type: index",
        "generator: core-discovery",
        "---",
        "",
        "# References",
        "",
        "_Auto-generated index of engagement content. Do not edit by hand._",
        "",
    ]
    if not entries:
        lines.append("_No content yet._")
        return "\n".join(lines) + "\n"

    lines.append("| Title | Type | Date | Source | Path |")
    lines.append("| ----- | ---- | ---- | ------ | ---- |")
    for e in entries:
        title = e["title"].replace("|", "\\|")
        source = e["source"].replace("|", "\\|")
        lines.append(
            f"| [{title}]({e['path']}) | {e['type']} | {e['date']} | {source} | `{e['path']}` |"
        )
    lines.append("")
    return "\n".join(lines)


def regenerate_references(content_dir: str | Path) -> dict[str, object]:
    """Rebuild `references.md` at the root of `content_dir`.

    Safe to call repeatedly. Returns `{path, count}` or `{error}`.
    """
    base = Path(content_dir)
    if not base.is_dir():
        return {"error": "Content directory not found"}
    entries = _collect_entries(base)
    target = base / _REFERENCES_FILENAME
    try:
        target.write_text(_render(entries), encoding="utf-8")
    except OSError as exc:
        logger.warning("Failed to write references index: %s", exc)
        return {"error": f"Failed to write references: {exc}"}
    return {"path": str(target), "count": len(entries)}
