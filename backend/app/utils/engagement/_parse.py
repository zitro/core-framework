"""Frontmatter parsing and content-dir discovery primitives."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)

MAX_FILE_SIZE = 200 * 1024  # 200 KB per file
MAX_TOTAL_SIZE = 500 * 1024  # 500 KB combined

_SKIP_DIRS = {
    "templates",
    "scripts",
    "docs",
    "artifact-templates",
    "security-plan-outputs",
    "node_modules",
    "__pycache__",
    ".github",
    ".vscode",
    ".cspell",
    ".git",
}


def _type_to_label(file_type: str) -> str:
    """Convert a frontmatter type slug to a human-readable label."""
    if not file_type:
        return "Notes"
    return file_type.replace("-", " ").replace("_", " ").title()


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Extract YAML frontmatter and body from a markdown file."""
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text

    try:
        fm: dict[str, Any] = {}
        for line in match.group(1).splitlines():
            if ":" not in line:
                continue
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if val.startswith("["):
                val = [
                    v.strip().strip('"').strip("'")
                    for v in val.strip("[]").split(",")
                    if v.strip()
                ]
            fm[key] = val
        body = text[match.end() :]
        return fm, body
    except Exception:
        return {}, text


def _find_content_dir(repo_path: Path) -> Path | None:
    """Locate the primary content directory inside the repo.

    Returns the first subdirectory containing markdown files with YAML
    frontmatter. Common infrastructure directories are skipped.
    """
    for child in sorted(repo_path.iterdir()):
        if not child.is_dir():
            continue
        if child.name in _SKIP_DIRS or child.name.startswith((".", "_")):
            continue
        for md in child.rglob("*.md"):
            try:
                head = md.read_text(encoding="utf-8", errors="ignore")[:500]
                if FRONTMATTER_RE.match(head):
                    return child
            except Exception:
                continue
    return None
