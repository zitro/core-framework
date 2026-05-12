"""URL parsing and normalization for GitHub repository sources."""

from __future__ import annotations

import re
from urllib.parse import urlparse


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


def parse_github_repo(repo_url: str) -> tuple[str, str]:
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
