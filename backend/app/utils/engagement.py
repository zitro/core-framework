"""Engagement repo integration — reads a structured markdown knowledge base.

Parses the directory structure and YAML frontmatter to produce
structured context for CORE agents.  Works with any Git-backed
markdown repo that uses frontmatter metadata.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)

MAX_FILE_SIZE = 200 * 1024  # 200 KB per file
MAX_TOTAL_SIZE = 500 * 1024  # 500 KB combined

# Directories to skip when scanning for the main content directory.
_SKIP_DIRS = {
    "templates", "scripts", "docs", "artifact-templates",
    "security-plan-outputs", "node_modules", "__pycache__",
    ".github", ".vscode", ".cspell", ".git",
}


def _type_to_label(file_type: str) -> str:
    """Convert a frontmatter type slug to a human-readable label.

    Examples: 'call-transcript' → 'Call Transcript', '' → 'Notes'
    """
    if not file_type:
        return "Notes"
    return file_type.replace("-", " ").replace("_", " ").title()


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Extract YAML frontmatter and body from a markdown file."""
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text

    try:
        # Lightweight YAML parsing — key: value pairs only (no PyYAML dep)
        fm: dict[str, Any] = {}
        for line in match.group(1).splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if val.startswith("["):
                    # Minimal list parsing
                    val = [
                        v.strip().strip('"').strip("'")
                        for v in val.strip("[]").split(",")
                        if v.strip()
                    ]
                fm[key] = val
        body = text[match.end():]
        return fm, body
    except Exception:
        return {}, text


def _find_content_dir(repo_path: Path) -> Path | None:
    """Locate the primary content directory inside the repo.

    Looks for the first subdirectory that contains markdown files with
    YAML frontmatter.  Skips common infrastructure directories.
    """
    for child in sorted(repo_path.iterdir()):
        if not child.is_dir():
            continue
        if child.name in _SKIP_DIRS or child.name.startswith((".", "_")):
            continue
        # Accept any dir that has at least one .md file with frontmatter
        for md in child.rglob("*.md"):
            try:
                head = md.read_text(encoding="utf-8", errors="ignore")[:500]
                if FRONTMATTER_RE.match(head):
                    return child
            except Exception:
                continue
    return None


def scan_engagement_repo(repo_path: str) -> dict[str, Any]:
    """Scan an engagement repo and return structured metadata.

    Discovers the content directory, identifies sub-projects (directories
    that contain markdown files with frontmatter), and indexes all files.

    Returns:
        {
            "path": str,
            "content_dir": str | None,
            "content_name": str,
            "projects": [str],
            "files": [{"path": str, "type": str, "title": str}],
        }
    """
    root = Path(repo_path)
    if not root.is_dir():
        return {"path": repo_path, "error": "Directory not found"}

    content_dir = _find_content_dir(root)
    result: dict[str, Any] = {
        "path": repo_path,
        "content_dir": str(content_dir) if content_dir else None,
        "content_name": "",
        "projects": [],
        "files": [],
    }

    if not content_dir:
        return result

    # Read name from the first frontmattered file at the root level
    for md in sorted(content_dir.glob("*.md")):
        try:
            fm, _ = _parse_frontmatter(md.read_text(encoding="utf-8"))
            name = fm.get("customer", fm.get("title", ""))
            if name:
                result["content_name"] = name
                break
        except Exception:
            continue
    if not result["content_name"]:
        result["content_name"] = content_dir.name

    # Find sub-projects (subdirs that contain frontmattered .md files)
    for child in sorted(content_dir.iterdir()):
        if not child.is_dir():
            continue
        for md in child.glob("*.md"):
            try:
                head = md.read_text(encoding="utf-8", errors="ignore")[:500]
                if FRONTMATTER_RE.match(head):
                    result["projects"].append(child.name)
                    break
            except Exception:
                continue

    # Index all markdown files
    for md_file in sorted(content_dir.rglob("*.md")):
        if md_file.name.startswith("_") or md_file.name == "README.md":
            continue
        rel = str(md_file.relative_to(content_dir))
        try:
            fm, _ = _parse_frontmatter(
                md_file.read_text(encoding="utf-8", errors="ignore")
            )
            file_type = fm.get("type", "")
            title = fm.get("title", fm.get("initiative", md_file.stem))
        except Exception:
            file_type = ""
            title = md_file.stem
        result["files"].append({
            "path": rel,
            "type": file_type,
            "title": title,
        })

    return result


def read_engagement_context(repo_path: str) -> str:
    """Read an engagement repo and produce structured text context for AI agents.

    Groups content by type so agents understand what kind of information
    each block represents (stakeholder data vs transcript vs decision etc.).
    """
    root = Path(repo_path)
    if not root.is_dir():
        return ""

    content_dir = _find_content_dir(root)
    if not content_dir:
        return ""

    sections: dict[str, list[str]] = {}
    total_size = 0

    for md_file in sorted(content_dir.rglob("*.md")):
        if md_file.name.startswith("_") or md_file.name == "README.md":
            continue
        if md_file.stat().st_size > MAX_FILE_SIZE:
            continue
        if total_size >= MAX_TOTAL_SIZE:
            break

        try:
            text = md_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        total_size += len(text.encode("utf-8"))
        fm, body = _parse_frontmatter(text)

        file_type = fm.get("type", "")
        label = _type_to_label(file_type)

        title = fm.get("title", fm.get("initiative", fm.get("customer", "")))
        header = f"[{label}]"
        if title:
            header += f" {title}"

        body_trimmed = body.strip()[:4000]
        block = f"{header}\n{body_trimmed}"

        sections.setdefault(label, []).append(block)

    if not sections:
        return ""

    parts: list[str] = ["Engagement notes:"]
    for label, blocks in sections.items():
        for block in blocks:
            parts.append(block)

    return "\n\n".join(parts)


def read_engagement_content_structured(repo_path: str) -> dict[str, Any]:
    """Read an engagement repo and return structured content for frontend rendering.

    Returns files grouped by type with frontmatter, body, and project info.
    """
    root = Path(repo_path)
    if not root.is_dir():
        return {"path": repo_path, "error": "Directory not found"}

    content_dir = _find_content_dir(root)
    result: dict[str, Any] = {
        "path": repo_path,
        "content_name": "",
        "projects": [],
        "content": [],
    }

    if not content_dir:
        return result

    # Read name from the first frontmattered file at the root level
    for md in sorted(content_dir.glob("*.md")):
        try:
            fm, _ = _parse_frontmatter(md.read_text(encoding="utf-8"))
            name = fm.get("customer", fm.get("title", ""))
            if name:
                result["content_name"] = name
                break
        except Exception:
            continue
    if not result["content_name"]:
        result["content_name"] = content_dir.name

    # Find sub-projects
    for child in sorted(content_dir.iterdir()):
        if not child.is_dir():
            continue
        for md in child.glob("*.md"):
            try:
                head = md.read_text(encoding="utf-8", errors="ignore")[:500]
                if FRONTMATTER_RE.match(head):
                    result["projects"].append(child.name)
                    break
            except Exception:
                continue

    # Read all markdown files with content
    total_size = 0
    for md_file in sorted(content_dir.rglob("*.md")):
        if md_file.name.startswith("_") or md_file.name == "README.md":
            continue
        if md_file.stat().st_size > MAX_FILE_SIZE:
            continue
        if total_size >= MAX_TOTAL_SIZE * 4:  # higher limit for structured reads
            break

        try:
            text = md_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        total_size += len(text.encode("utf-8"))
        fm, body = _parse_frontmatter(text)

        file_type = fm.get("type", "")
        type_label = _type_to_label(file_type)
        title = fm.get("title", fm.get("initiative", fm.get("customer", md_file.stem)))
        rel = str(md_file.relative_to(content_dir))

        # Determine which project this file belongs to
        parts = Path(rel).parts
        project = parts[0] if len(parts) > 1 and parts[0] in result["projects"] else None

        result["content"].append({
            "path": rel,
            "type": file_type,
            "type_label": type_label,
            "title": title,
            "frontmatter": fm,
            "body": body.strip(),
            "project": project,
        })

    return result
