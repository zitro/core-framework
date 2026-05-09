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
    result = resolve_project_repo_path("sample-claims")
    expected = Path(settings.projects_root).expanduser() / "sample-claims"
    assert result == expected


def test_backslash_relative_path_normalized_under_projects_root() -> None:
    result = resolve_project_repo_path("sample-claims\\phase-1")
    expected = Path(settings.projects_root).expanduser() / "sample-claims" / "phase-1"
    assert result == expected


def test_windows_absolute_path_kept_when_projects_root_is_not_container_style(
    tmp_path: Path,
) -> None:
    original_projects_root = settings.projects_root
    try:
        settings.projects_root = str(tmp_path)
        raw = r"C:\Users\someone\Documents\sample-project\repo"

        result = resolve_project_repo_path(raw)

        assert str(result).replace("\\", "/") == "C:/Users/someone/Documents/sample-project/repo"
    finally:
        settings.projects_root = original_projects_root


def test_single_folder_name_resolves_to_unique_nested_directory(tmp_path: Path) -> None:
    original_projects_root = settings.projects_root
    try:
        settings.projects_root = str(tmp_path)
        target = tmp_path / "outside" / "nested" / "my-picked-folder"
        target.mkdir(parents=True)

        result = resolve_project_repo_path("my-picked-folder")

        assert result == target
    finally:
        settings.projects_root = original_projects_root


def test_single_folder_name_with_multiple_matches_stays_root_relative(tmp_path: Path) -> None:
    original_projects_root = settings.projects_root
    try:
        settings.projects_root = str(tmp_path)
        (tmp_path / "a" / "dupe").mkdir(parents=True)
        (tmp_path / "b" / "dupe").mkdir(parents=True)

        result = resolve_project_repo_path("dupe")

        assert result == tmp_path / "dupe"
    finally:
        settings.projects_root = original_projects_root


def test_file_uri_input_is_normalized_for_windows_drive_path() -> None:
    result = resolve_project_repo_path("file:///C:/Users/test/Documents/repo")
    assert str(result).replace("\\", "/") == "C:/Users/test/Documents/repo"
