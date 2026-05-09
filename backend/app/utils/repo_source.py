"""Repository source materialization for remote URLs."""

from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import time
import hashlib
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zipfile import BadZipFile, ZipFile, is_zipfile

from app.config import settings


class RepoSourceError(RuntimeError):
    """Raised when a remote repository source cannot be materialized."""


_GITHUB_WEB_HOSTS = {"github.com", "www.github.com"}


def normalize_github_repo_source(value: str) -> str:
    """Normalize common GitHub input formats to https://github.com/owner/repo.

    Supported forms:
    - https://github.com/owner/repo
    - github.com/owner/repo
    - git@github.com:owner/repo.git
    - ssh://git@github.com/owner/repo.git
    """
    raw = str(value or "").strip()
    if not raw:
        return ""

    ssh_match = re.match(r"^git@github\.com:(?P<owner>[^/]+)/(?P<repo>[^\s]+?)(?:\.git)?/?$", raw)
    if ssh_match:
        owner = ssh_match.group("owner")
        repo = ssh_match.group("repo")
        return f"https://github.com/{owner}/{repo}"

    if raw.startswith("ssh://git@github.com/"):
        tail = raw[len("ssh://git@github.com/") :].strip("/")
        parts = [p for p in tail.split("/") if p]
        if len(parts) >= 2:
            owner = parts[0]
            repo = parts[1][:-4] if parts[1].endswith(".git") else parts[1]
            return f"https://github.com/{owner}/{repo}"

    if raw.startswith("github.com/"):
        return f"https://{raw}"

    try:
        parsed = urlparse(raw)
    except ValueError:
        return raw

    if parsed.scheme in {"http", "https"} and parsed.netloc.lower() in _GITHUB_WEB_HOSTS:
        parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(parts) >= 2:
            owner = parts[0]
            repo = parts[1][:-4] if parts[1].endswith(".git") else parts[1]
            return f"https://github.com/{owner}/{repo}"
    return raw


def is_github_repo_url(value: str) -> bool:
    """Return True when value looks like a GitHub repository source."""
    normalized = normalize_github_repo_source(value)
    try:
        parsed = urlparse((normalized or "").strip())
    except ValueError:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    return parsed.netloc.lower() in _GITHUB_WEB_HOSTS


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
                zf.extractall(extract_dir)
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


def _parse_github_repo(repo_url: str) -> tuple[str, str]:
    parsed = urlparse(normalize_github_repo_source(repo_url))
    if parsed.netloc.lower() not in _GITHUB_WEB_HOSTS:
        raise RepoSourceError("Only github.com repository URLs are supported")
    parts = [p for p in parsed.path.strip("/").split("/") if p]
    if len(parts) < 2:
        raise RepoSourceError("Invalid GitHub repository URL")
    owner = parts[0]
    repo = parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    if not owner or not repo:
        raise RepoSourceError("Invalid GitHub repository URL")
    return owner, repo


def _github_request(url: str, oauth_token: str | None = None) -> Request:
    token = str(oauth_token or "").strip() or os.getenv("GITHUB_TOKEN", "").strip()
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "core-discovery-api",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return Request(url, headers=headers)


def _get_default_branch(owner: str, repo: str, oauth_token: str | None = None) -> str:
    url = f"https://api.github.com/repos/{owner}/{repo}"
    try:
        with urlopen(_github_request(url, oauth_token), timeout=20) as resp:  # noqa: S310
            payload = json.loads(resp.read().decode("utf-8"))
        return str(payload.get("default_branch") or "").strip()
    except Exception:
        return ""


def _get_default_branch_from_html(owner: str, repo: str) -> str:
    url = f"https://github.com/{owner}/{repo}"
    try:
        req = Request(url, headers={"User-Agent": "core-discovery-api"})
        with urlopen(req, timeout=20) as resp:  # noqa: S310
            html = resp.read().decode("utf-8", errors="ignore")
        # Works with current GitHub page payload format.
        match = re.search(r'"defaultBranch"\s*:\s*"([^"]+)"', html)
        return (match.group(1) if match else "").strip()
    except Exception:
        return ""


def _download_archive(
    owner: str,
    repo: str,
    branch: str,
    destination: Path,
    oauth_token: str | None = None,
) -> None:
    # Prefer API zipball (supports private repos with GITHUB_TOKEN), then
    # fallback to public archive URL for unauthenticated access.
    candidates = [
        (f"https://api.github.com/repos/{owner}/{repo}/zipball/{branch}" if branch else f"https://api.github.com/repos/{owner}/{repo}/zipball", True),
        (f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip", False) if branch else ("", False),
        (f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}", False) if branch else ("", False),
    ]

    last_error: Exception | None = None
    for url, use_api_headers in candidates:
        if not url:
            continue
        try:
            req = _github_request(url, oauth_token) if use_api_headers else Request(url)
            with urlopen(req, timeout=60) as resp, destination.open("wb") as out:  # noqa: S310
                shutil.copyfileobj(resp, out)
            return
        except Exception as exc:  # pragma: no cover - network edge path
            last_error = exc
            destination.unlink(missing_ok=True)

    if last_error is not None:
        raise last_error
