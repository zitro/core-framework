"""Archive download and safe extraction helpers for GitHub repository sources."""

from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile

from app.utils.repo_source_normalize import RepoSourceError


def _safe_extractall(zf: ZipFile, extract_dir: Path) -> None:
    """Extract every zip member, refusing any whose resolved path would
    escape ``extract_dir``. Closes the zip-slip vulnerability that
    ``ZipFile.extractall`` exposes when archives come from external
    sources (here: GitHub repository archives, which a malicious or
    compromised repo can poison).
    """
    base = extract_dir.resolve()
    for member in zf.infolist():
        member_path = (base / member.filename).resolve()
        try:
            member_path.relative_to(base)
        except ValueError as exc:
            raise RepoSourceError(
                f"Refused to extract zip entry outside target directory: {member.filename!r}"
            ) from exc
        # Refuse symlinks too — extractall doesn't honor them by default,
        # but if the member type advertises one we don't want to follow.
        # 0xA000 is the symlink flag in zip external_attr.
        if (member.external_attr >> 16) & 0xF000 == 0xA000:
            raise RepoSourceError(f"Refused to extract symlink zip entry: {member.filename!r}")
    zf.extractall(base)


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
        (
            f"https://api.github.com/repos/{owner}/{repo}/zipball/{branch}"
            if branch
            else f"https://api.github.com/repos/{owner}/{repo}/zipball",
            True,
        ),
        (f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip", False)
        if branch
        else ("", False),
        (f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}", False)
        if branch
        else ("", False),
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
