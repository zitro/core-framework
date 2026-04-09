"""engagement repo integration — reads a engagement Git-backed note-taking repo.

Parses the directory structure and YAML frontmatter to produce
structured context for CORE agents.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)

# Content types we want to ingest, mapped to context labels
TYPE_LABELS: dict[str, str] = {
    "customer-details": "Customer Details",
    "customer-stakeholders": "Customer Stakeholders",
    "msft-stakeholders": "Microsoft Stakeholders",
    "tech-stack": "Technology Stack",
    "initiative-overview": "Initiative Overview",
    "approach": "Approach",
    "architecture-overview": "Architecture Overview",
    "game-plan": "Game Plan",
    "risk-register": "Risk Register",
    "call-transcript": "Call Transcript",
    "chat": "Chat Record",
    "email": "Email",
    "decision": "Decision Record",
    "status-update": "Status Update",
    "workshop": "Workshop Notes",
    "mve": "MVE Scope",
    "advisory": "Advisory Notes",
    "activity-overview": "Activity Overview",
    "demos": "Demo Catalog",
    "ai-design-win": "AI Design Win",
}

MAX_FILE_SIZE = 200 * 1024  # 200 KB per file
MAX_TOTAL_SIZE = 500 * 1024  # 500 KB combined


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
    """Locate the customer directory (skip _sample-customer, templates, etc.)."""
    skip = {
        "_sample-customer",
        "templates",
        "scripts",
        "docs",
        "artifact-templates",
        "security-plan-outputs",
        ".github",
        ".vscode",
        ".cspell",
        ".git",
    }
    for child in sorted(repo_path.iterdir()):
        if child.is_dir() and child.name not in skip and not child.name.startswith("."):
            # Check if it looks like a customer dir (has customer-details.md)
            if (child / "customer-details.md").exists():
                return child
    return None


def scan_engagement_repo(repo_path: str) -> dict[str, Any]:
    """Scan a engagement repo and return structured metadata.

    Returns:
        {
            "path": str,
            "customer_dir": str | None,
            "customer_name": str,
            "initiatives": [str],
            "files": [{"path": str, "type": str, "title": str}],
        }
    """
    root = Path(repo_path)
    if not root.is_dir():
        return {"path": repo_path, "error": "Directory not found"}

    customer_dir = _find_content_dir(root)
    result: dict[str, Any] = {
        "path": repo_path,
        "customer_dir": str(customer_dir) if customer_dir else None,
        "customer_name": "",
        "initiatives": [],
        "files": [],
    }

    if not customer_dir:
        return result

    # Read customer name
    details_file = customer_dir / "customer-details.md"
    if details_file.exists():
        try:
            fm, _ = _parse_frontmatter(details_file.read_text(encoding="utf-8"))
            result["customer_name"] = fm.get("customer", customer_dir.name)
        except Exception:
            result["customer_name"] = customer_dir.name

    # Find initiatives
    for child in sorted(customer_dir.iterdir()):
        if child.is_dir() and (child / "initiative-overview.md").exists():
            result["initiatives"].append(child.name)

    # Index all markdown files
    for md_file in sorted(customer_dir.rglob("*.md")):
        if md_file.name.startswith("_") or md_file.name == "README.md":
            continue
        rel = str(md_file.relative_to(customer_dir))
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
    """Read a engagement repo and produce structured text context for AI agents.

    Groups content by type so agents understand what kind of information
    each block represents (stakeholder data vs transcript vs decision etc.).
    """
    root = Path(repo_path)
    if not root.is_dir():
        return ""

    customer_dir = _find_content_dir(root)
    if not customer_dir:
        return ""

    sections: dict[str, list[str]] = {}
    total_size = 0

    # Process customer-level files first, then initiatives
    for md_file in sorted(customer_dir.rglob("*.md")):
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
        label = TYPE_LABELS.get(file_type, file_type or "Notes")

        # Build a concise block
        title = fm.get("title", fm.get("initiative", fm.get("customer", "")))
        header = f"[{label}]"
        if title:
            header += f" {title}"

        # Keep body trimmed
        body_trimmed = body.strip()[:4000]
        block = f"{header}\n{body_trimmed}"

        sections.setdefault(label, []).append(block)

    if not sections:
        return ""

    parts: list[str] = ["engagement notes:"]
    for label, blocks in sections.items():
        for block in blocks:
            parts.append(block)

    return "\n\n".join(parts)
