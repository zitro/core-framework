"""Build human-readable engagement context strings for AI agents."""

from __future__ import annotations

from pathlib import Path

from app.utils.engagement._parse import (
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
    _find_content_dir,
    _parse_frontmatter,
    _type_to_label,
)


def read_engagement_context(repo_path: str) -> str:
    """Read an engagement repo and produce structured text context for AI agents.

    Groups content by type so agents understand what kind of information each
    block represents (stakeholder data vs transcript vs decision etc.).
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

        label = _type_to_label(fm.get("type", ""))
        title = fm.get("title", fm.get("initiative", fm.get("customer", "")))
        header = f"[{label}]"
        if title:
            header += f" {title}"

        block = f"{header}\n{body.strip()[:4000]}"
        sections.setdefault(label, []).append(block)

    if not sections:
        return ""

    parts: list[str] = ["Engagement notes:"]
    for blocks in sections.values():
        parts.extend(blocks)

    return "\n\n".join(parts)
