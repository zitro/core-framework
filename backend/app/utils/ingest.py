"""Content ingest — AI-powered classification and placement into a markdown repo.

Scans the target repo to discover its structure, then uses the LLM to
classify raw content and decide where it belongs. Repo-agnostic: no
hardcoded knowledge of any specific repo template.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from app.providers.llm import get_llm_provider
from app.utils.references import regenerate_references

logger = logging.getLogger(__name__)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", re.DOTALL)


def _discover_repo_structure(repo_path: str) -> dict[str, Any]:
    """Scan a markdown repo and return its structure for AI context.

    Returns directory layout, existing content types found in frontmatter,
    file naming patterns, and sample frontmatter blocks.
    """
    root = Path(repo_path)
    if not root.is_dir():
        return {"error": "Directory not found"}

    # Find the main content directory (skip dot-dirs, templates, scripts)
    skip = {
        "templates",
        "scripts",
        "docs",
        "artifact-templates",
        "security-plan-outputs",
        ".github",
        ".vscode",
        ".cspell",
        ".git",
        "node_modules",
        "__pycache__",
    }
    content_dir: Path | None = None
    for child in sorted(root.iterdir()):
        if child.is_dir() and child.name not in skip and not child.name.startswith((".", "_")):
            # Check if it has markdown files
            if any(child.rglob("*.md")):
                content_dir = child
                break

    if not content_dir:
        return {"path": repo_path, "content_dir": None, "types": [], "dirs": []}

    # Discover types and directory structure
    types_seen: set[str] = set()
    samples: list[dict[str, str]] = []
    dirs: list[str] = []

    for child in sorted(content_dir.iterdir()):
        if child.is_dir():
            dirs.append(child.name)

    for md_file in sorted(content_dir.rglob("*.md")):
        if md_file.name.startswith("_") or md_file.name == "README.md":
            continue
        try:
            text = md_file.read_text(encoding="utf-8", errors="ignore")[:2000]
        except Exception:
            continue

        match = FRONTMATTER_RE.match(text)
        if not match:
            continue

        fm_text = match.group(1)
        fm: dict[str, str] = {}
        for line in fm_text.splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                fm[key.strip()] = val.strip().strip('"').strip("'")

        file_type = fm.get("type", "")
        if file_type:
            types_seen.add(file_type)

        # Keep a few samples for context (max 8)
        if len(samples) < 8:
            rel = str(md_file.relative_to(content_dir))
            samples.append({"path": rel, "frontmatter": fm_text.strip()})

    return {
        "path": repo_path,
        "content_dir": str(content_dir),
        "content_dir_name": content_dir.name,
        "subdirs": dirs,
        "types": sorted(types_seen),
        "samples": samples,
    }


def _build_classification_prompt(
    repo_structure: dict[str, Any], raw_content: str
) -> tuple[str, str]:
    """Build system and user prompts for the AI classifier."""
    types_list = ", ".join(repo_structure.get("types", [])) or "none discovered"
    subdirs = ", ".join(repo_structure.get("subdirs", [])) or "none"
    samples_text = ""
    for s in repo_structure.get("samples", []):
        samples_text += f"\nFile: {s['path']}\n---\n{s['frontmatter']}\n---\n"

    system = (
        "You are a content classifier for a structured markdown knowledge base. "
        "Given raw content (text, transcript, email, notes, etc.), you must:\n\n"
        "1. Identify what TYPE of content it is based on the existing types in the repo\n"
        "2. Extract key metadata (title, date, participants, etc.)\n"
        "3. Decide WHERE in the directory structure it should be placed\n"
        "4. Determine if it should be a NEW file or APPENDED to an existing file\n"
        "5. Generate properly formatted markdown with YAML frontmatter\n\n"
        "Return JSON with this exact format:\n"
        "{\n"
        '  "classification": {\n'
        '    "type": "the content type (use existing types when they fit)",\n'
        '    "title": "a descriptive title",\n'
        '    "confidence": "high|medium|low"\n'
        "  },\n"
        '  "placement": {\n'
        '    "directory": "subdirectory name (or empty string for root level)",\n'
        '    "filename": "suggested-filename.md",\n'
        '    "action": "create|append",\n'
        '    "append_target": "existing-file.md if action is append, else empty string"\n'
        "  },\n"
        '  "generated_content": "full markdown with YAML frontmatter ready to write",\n'
        '  "summary": "one-sentence summary of what was classified"\n'
        "}\n"
    )

    user = (
        f"## Repository structure\n\n"
        f"Content directory: {repo_structure.get('content_dir_name', 'unknown')}/\n"
        f"Subdirectories: {subdirs}\n"
        f"Existing content types: {types_list}\n\n"
        f"## Sample frontmatter from existing files\n{samples_text}\n\n"
        f"## Raw content to classify and format\n\n"
        f"{raw_content[:12000]}"
    )

    return system, user


async def classify_and_place(repo_path: str, raw_content: str) -> dict[str, Any]:
    """Classify raw content and suggest placement in the repo.

    Returns the AI classification result without writing any files.
    """
    structure = _discover_repo_structure(repo_path)
    if "error" in structure or not structure.get("content_dir"):
        return {
            "error": "Could not discover repo structure",
            "structure": structure,
        }

    system_prompt, user_prompt = _build_classification_prompt(structure, raw_content)

    llm = get_llm_provider()
    try:
        result = await llm.complete_json(system_prompt, user_prompt, max_tokens=4000)
    except Exception:
        logger.exception("Content classification LLM call failed")
        return {"error": "AI service unavailable"}

    # Attach repo context so the caller knows where to write
    result["repo_path"] = repo_path
    result["content_dir"] = structure["content_dir"]
    return result


def write_classified_content(
    content_dir: str,
    directory: str,
    filename: str,
    content: str,
    action: str = "create",
    append_target: str = "",
) -> dict[str, Any]:
    """Write AI-classified content to the repo filesystem.

    Returns the path of the written file.
    """
    base = Path(content_dir)
    if not base.is_dir():
        return {"error": "Content directory not found"}

    target_dir = base / directory if directory else base
    target_dir.mkdir(parents=True, exist_ok=True)

    if action == "append" and append_target:
        target_file = target_dir / append_target
        if target_file.exists():
            existing = target_file.read_text(encoding="utf-8")
            # Append with a separator
            combined = existing.rstrip() + "\n\n---\n\n" + content
            target_file.write_text(combined, encoding="utf-8")
        else:
            # Fall back to create if target doesn't exist
            target_file = target_dir / filename
            target_file.write_text(content, encoding="utf-8")
    else:
        target_file = target_dir / filename
        # Don't overwrite existing files — add a suffix
        if target_file.exists():
            stem = target_file.stem
            suffix = target_file.suffix
            counter = 1
            while target_file.exists():
                target_file = target_dir / f"{stem}-{counter}{suffix}"
                counter += 1
        target_file.write_text(content, encoding="utf-8")

    rel = str(target_file.relative_to(base))
    # Refresh the auto-generated references index so the engagement repo
    # always has an up-to-date catalog of its own content.
    ref_result = regenerate_references(base)
    return {
        "path": rel,
        "full_path": str(target_file),
        "action": action,
        "references_index": ref_result,
    }
