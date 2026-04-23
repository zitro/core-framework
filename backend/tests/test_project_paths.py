"""project_paths.resolve_project_repo_path — root, absolute, relative cases."""

from pathlib import Path

from app.config import settings
from app.utils.project_paths import resolve_project_repo_path


def test_empty_repo_path_returns_projects_root() -> None:
    result = resolve_project_repo_path("")
    assert result == Path(settings.projects_root).expanduser()


def test_absolute_repo_path_returned_unchanged(tmp_path: Path) -> None:
    abs_path = tmp_path / "elsewhere"
    result = resolve_project_repo_path(str(abs_path))
    assert result == abs_path


def test_relative_repo_path_joined_under_projects_root() -> None:
    result = resolve_project_repo_path("acme-project")
    expected = Path(settings.projects_root).expanduser() / "acme-project"
    assert result == expected
