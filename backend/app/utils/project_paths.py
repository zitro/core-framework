"""Project path resolution.

Centralizes how an engagement's ``repo_path`` is turned into an actual
filesystem path. Absolute paths are returned as-is. Relative paths are
resolved against ``settings.projects_root`` so customer deploys can mount a
single ``/data/projects`` directory and reference subdirectories by name.
"""

from __future__ import annotations

from pathlib import Path

from app.config import settings


def resolve_project_repo_path(repo_path: str) -> Path:
    """Resolve a project repo_path to an absolute Path.

    - Empty string returns ``settings.projects_root`` itself.
    - Absolute paths are returned unchanged.
    - Relative paths are joined under ``settings.projects_root``.
    """
    root = Path(settings.projects_root).expanduser()
    if not repo_path:
        return root
    p = Path(repo_path).expanduser()
    if p.is_absolute():
        return p
    return root / p
