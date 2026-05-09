"""Project path resolution.

Centralizes how an engagement's ``repo_path`` is turned into an actual
filesystem path. Absolute paths are returned as-is. Relative paths are
resolved against ``settings.projects_root`` so customer deploys can mount a
single ``/data/projects`` directory and reference subdirectories by name.
"""

from __future__ import annotations

import re
from collections import deque
from pathlib import Path
from urllib.parse import unquote, urlparse

from app.config import settings

_MAX_FOLDER_PICKER_SEARCH_DEPTH = 6
_MAX_FOLDER_PICKER_SEARCH_DIRS = 2500
_FOLDER_PICKER_SKIP_DIRS = {
    "$Recycle.Bin",
    ".git",
    ".hg",
    ".svn",
    "AppData",
    "Library",
    "node_modules",
    "Program Files",
    "Program Files (x86)",
    "ProgramData",
    "System Volume Information",
    "Windows",
    "__pycache__",
}


def _resolve_unique_dir_by_name(root: Path, name: str) -> Path | None:
    """Return a unique directory match for ``name`` under ``root``.

    This supports browser folder pickers that only provide the selected folder
    name. If exactly one directory with that basename exists under the mounted
    projects root, treat it as the intended target.
    """
    if not name:
        return None
    matches: list[Path] = []
    visited = 0
    queue: deque[tuple[Path, int]] = deque([(root, 0)])

    while queue and visited < _MAX_FOLDER_PICKER_SEARCH_DIRS:
        current, depth = queue.popleft()
        visited += 1

        if current.name == name:
            matches.append(current)
            if len(matches) > 1:
                return None

        if depth >= _MAX_FOLDER_PICKER_SEARCH_DEPTH:
            continue

        try:
            children = sorted(
                child
                for child in current.iterdir()
                if child.is_dir()
                and child.name not in _FOLDER_PICKER_SKIP_DIRS
                and not child.name.startswith(".")
            )
        except OSError:
            continue

        for child in children:
            queue.append((child, depth + 1))

    return matches[0] if len(matches) == 1 else None


def resolve_project_repo_path(repo_path: str) -> Path:
    """Resolve a project repo_path to an absolute Path.

    - Empty string returns ``settings.projects_root`` itself.
    - Absolute paths are returned unchanged.
    - Relative paths are joined under ``settings.projects_root``.
    """
    root = Path(settings.projects_root).expanduser()
    value = (repo_path or "").strip()
    if not value:
        return root

    if value.lower().startswith("file://"):
        parsed = urlparse(value)
        # file:///C:/path or file:///data/projects/path
        value = unquote(parsed.path or "").strip()
        if re.match(r"^/[A-Za-z]:/", value):
            value = value[1:]

    # Normalize separators so Linux containers can resolve paths entered from
    # Windows UIs (for example: "folder\\subfolder").
    normalized = value.replace("\\", "/")
    # If a Windows absolute path is provided to a Linux container
    # (for example: "C:\\Users\\me\\repo"), try to map its trailing segments
    # under PROJECTS_ROOT and return the first existing match.
    should_remap_windows_path = root.as_posix().startswith("/")
    if should_remap_windows_path and re.match(r"^[A-Za-z]:[\\/]", value):
        tail = re.sub(r"^[A-Za-z]:[\\/]?", "", value).replace("\\", "/")
        parts = [part for part in tail.split("/") if part and part != "."]
        if not parts:
            return root
        for idx in range(len(parts)):
            candidate = root.joinpath(*parts[idx:])
            if candidate.is_dir():
                return candidate
        return root.joinpath(*parts)

    p = Path(normalized).expanduser()
    if p.is_absolute():
        return p

    resolved = root / p
    if not resolved.exists() and len(p.parts) == 1:
        unique = _resolve_unique_dir_by_name(root, p.name)
        if unique is not None:
            return unique

    return resolved
