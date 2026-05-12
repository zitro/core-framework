"""Repository source materialization for remote URLs."""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError
from zipfile import BadZipFile, ZipFile, is_zipfile

from app.config import settings
from app.utils.repo_source_archive import (
    _download_archive,
    _get_default_branch,
    _get_default_branch_from_html,
    _github_request,
    _safe_extractall,
)
from app.utils.repo_source_normalize import (
    RepoSourceError,
    is_github_repo_url,
    normalize_github_repo_source,
    parse_github_repo as _parse_github_repo,
)

__all__ = [
    "RepoSourceError",
    "delete_github_repo_source_cache",
    "ensure_github_repo_source",
    "is_github_repo_url",
    "normalize_github_repo_source",
    "_safe_extractall",
    "_github_request",
    "_get_default_branch",
    "_get_default_branch_from_html",
    "_download_archive",
    "_parse_github_repo",
]


def ensure_github_repo_source(
    repo_url: str,
    *,
    refresh: bool = False,
    oauth_token: str | None = None,
) -> Path:
    """Download/extract a GitHub repository into local cache and return its path.

    This supports URL-based sources without requiring ``git`` in the container.
    """
    normalized_repo_url = normalize_github_repo_source(repo_url)
    owner, repo = _parse_github_repo(normalized_repo_url)
    target = _repo_cache_dir(owner, repo, oauth_token)
    if target.is_dir() and not refresh:
        return target

    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f"repo-src-{owner}-{repo}-") as tmp:
        tmp_dir = Path(tmp)
        archive_path = tmp_dir / "repo.zip"

        branch_candidates: list[str] = [""]
        default_branch = _get_default_branch(owner, repo, oauth_token)
        if default_branch:
            branch_candidates.append(default_branch)
        html_default_branch = _get_default_branch_from_html(owner, repo)
        if html_default_branch:
            branch_candidates.append(html_default_branch)
        for fallback in ("main", "master", "trunk", "develop", "dev"):
            if fallback not in branch_candidates:
                branch_candidates.append(fallback)

        last_error: Exception | None = None
        for branch in branch_candidates:
            try:
                _download_archive(owner, repo, branch, archive_path, oauth_token)
                if not is_zipfile(archive_path):
                    raise BadZipFile("Downloaded file is not a zip archive")
                break
            except Exception as exc:  # pragma: no cover - network edge path
                last_error = exc
                if archive_path.exists():
                    archive_path.unlink(missing_ok=True)
        else:
            message = f"Could not download GitHub repository '{owner}/{repo}'."
            if isinstance(last_error, HTTPError) and last_error.code in (401, 403, 404):
                message = (
                    f"GitHub repository '{owner}/{repo}' could not be accessed. "
                    "For private repositories, provide GITHUB_TOKEN with repo read access."
                )
            elif isinstance(last_error, BadZipFile):
                message = (
                    f"GitHub repository '{owner}/{repo}' could not be downloaded as an archive. "
                    "This usually means the repository is private and no token was provided. "
                    "Set GITHUB_TOKEN or connect GitHub OAuth."
                )
            raise RepoSourceError(message) from last_error

        extract_dir = tmp_dir / "extract"
        extract_dir.mkdir(parents=True, exist_ok=True)
        try:
            with ZipFile(archive_path) as zf:
                _safe_extractall(zf, extract_dir)
        except BadZipFile as exc:  # pragma: no cover - network edge path
            raise RepoSourceError(
                f"Could not download GitHub repository '{owner}/{repo}'."
            ) from exc

        children = [p for p in extract_dir.iterdir() if p.is_dir()]
        source_root = children[0] if len(children) == 1 else extract_dir

        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(source_root), str(target))

        meta = {
            "source": normalized_repo_url,
            "fetched_at": int(time.time()),
            "owner": owner,
            "repo": repo,
        }
        (target / ".source.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return target


def _repo_cache_dir(owner: str, repo: str, oauth_token: str | None) -> Path:
    root = Path(settings.local_storage_path).expanduser()
    base = root / "repo-sources" / "github" / owner / repo
    token = str(oauth_token or "").strip()
    if not token:
        return base
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]
    return base / digest


def delete_github_repo_source_cache(repo_url: str) -> bool:
    """Delete cached materialized GitHub source for owner/repo.

    Removes the entire owner/repo cache tree, including token-scoped subfolders.
    Returns True if any cached data was removed.
    """
    owner, repo = _parse_github_repo(repo_url)
    root = Path(settings.local_storage_path).expanduser()
    base = root / "repo-sources" / "github" / owner / repo
    if not base.exists():
        return False
    shutil.rmtree(base, ignore_errors=True)
    return True
