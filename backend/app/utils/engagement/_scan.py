"""Engagement repo scanning and structured content reads."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.utils.engagement._parse import (
    FRONTMATTER_RE,
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
    _find_content_dir,
    _parse_frontmatter,
    _type_to_label,
)


def _read_content_name(content_dir: Path) -> str:
    for md in sorted(content_dir.glob("*.md")):
        try:
            fm, _ = _parse_frontmatter(md.read_text(encoding="utf-8"))
            name = fm.get("customer", fm.get("title", ""))
            if name:
                return name
        except Exception:
            continue
    return content_dir.name


def _discover_projects(content_dir: Path) -> list[str]:
    projects: list[str] = []
    for child in sorted(content_dir.iterdir()):
        if not child.is_dir():
            continue
        for md in child.glob("*.md"):
            try:
                head = md.read_text(encoding="utf-8", errors="ignore")[:500]
                if FRONTMATTER_RE.match(head):
                    projects.append(child.name)
                    break
            except Exception:
                continue
    return projects


def scan_engagement_repo(repo_path: str) -> dict[str, Any]:
    """Scan an engagement repo and return structured metadata.

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

    result["content_name"] = _read_content_name(content_dir)
    result["projects"] = _discover_projects(content_dir)

    for md_file in sorted(content_dir.rglob("*.md")):
        if md_file.name.startswith("_") or md_file.name == "README.md":
            continue
        rel = str(md_file.relative_to(content_dir))
        try:
            fm, _ = _parse_frontmatter(md_file.read_text(encoding="utf-8", errors="ignore"))
            file_type = fm.get("type", "")
            title = fm.get("title", fm.get("initiative", md_file.stem))
        except Exception:
            file_type = ""
            title = md_file.stem
        result["files"].append({"path": rel, "type": file_type, "title": title})

    return result


def read_engagement_content_structured(repo_path: str) -> dict[str, Any]:
    """Read an engagement repo and return structured content for frontend rendering."""
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

    result["content_name"] = _read_content_name(content_dir)
    result["projects"] = _discover_projects(content_dir)

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

        parts = Path(rel).parts
        project = parts[0] if len(parts) > 1 and parts[0] in result["projects"] else None

        result["content"].append(
            {
                "path": rel,
                "type": file_type,
                "type_label": type_label,
                "title": title,
                "frontmatter": fm,
                "body": body.strip(),
                "project": project,
            }
        )

    return result
