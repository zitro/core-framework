"""Thin git wrapper for v2.2 multi-source workspaces.

Wraps GitPython for the four operations the app needs:

  * ``ensure_clone`` — idempotent clone-or-noop into the source workspace.
  * ``pull_rebase``  — fetch + rebase main onto origin/main.
  * ``commit_paths`` — stage paths + commit with a message; no-op if clean.
  * ``push``         — push current branch to ``origin``.

Authentication for GITHUB sources uses the per-source PAT injected into
the remote URL: ``https://x-access-token:{pat}@github.com/{owner}/{repo}``.
The PAT is decrypted in-process and never written to disk in plaintext;
the remote URL is set per-call and reverted afterwards so the on-disk
``.git/config`` keeps the canonical URL.

All functions are synchronous and assumed to be called from a worker
context (FastAPI ``run_in_threadpool``). They raise ``GitOpError`` on
failure with a user-safe message; original exceptions are chained.
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from git import GitCommandError, Repo
from git.exc import InvalidGitRepositoryError, NoSuchPathError

from app.models.customer import Source, SourceKind
from app.utils.crypto import decrypt_secret


class GitOpError(RuntimeError):
    """Raised when a git operation fails; message is safe to surface."""


@dataclass(frozen=True)
class CommitResult:
    sha: str
    message: str
    files_changed: int
    nothing_to_commit: bool = False


def _github_url(location: str, pat: str) -> str:
    """Compose an authenticated HTTPS URL for ``owner/repo`` + PAT.

    ``location`` may be ``owner/repo``, a full https URL, or a git@ URL.
    For ssh/non-https remotes we leave the URL untouched and let the
    caller's environment handle auth.
    """
    if "://" not in location and "@" not in location:
        location = f"https://github.com/{location}.git"
    if pat and location.startswith("https://github.com/"):
        return location.replace(
            "https://github.com/", f"https://x-access-token:{pat}@github.com/", 1
        )
    return location


@contextmanager
def _authed_remote(repo: Repo, source: Source):
    """Temporarily set ``origin`` URL to an authed variant; restore after."""
    if source.kind != SourceKind.GITHUB:
        yield
        return
    pat = decrypt_secret(source.pat_encrypted)
    if not pat:
        yield
        return
    origin = repo.remote("origin")
    original = next(iter(origin.urls), "")
    authed = _github_url(source.location, pat)
    try:
        origin.set_url(authed)
        yield
    finally:
        if original:
            origin.set_url(original)


def ensure_clone(target: Path, source: Source) -> Repo:
    """Open ``target`` as a Repo; clone from ``source`` if missing.

    ``LOCAL`` sources must already be valid repos at ``source.location``.
    ``FOLDER`` sources are not git repos — caller should not invoke this.
    """
    if source.kind == SourceKind.FOLDER:
        raise GitOpError("FOLDER sources are not git repositories")

    if source.kind == SourceKind.LOCAL:
        try:
            return Repo(source.location)
        except (InvalidGitRepositoryError, NoSuchPathError) as exc:
            raise GitOpError(f"LOCAL source path is not a git repo: {source.location}") from exc

    # GITHUB: clone if missing
    target.parent.mkdir(parents=True, exist_ok=True)
    if (target / ".git").is_dir():
        return Repo(target)
    pat = decrypt_secret(source.pat_encrypted)
    url = _github_url(source.location, pat)
    try:
        return Repo.clone_from(
            url, target, branch=source.branch or "main", depth=1, single_branch=True
        )
    except GitCommandError as exc:
        # Strip any leaked PAT from the message before re-raising
        msg = str(exc).replace(pat, "***") if pat else str(exc)
        raise GitOpError(f"Clone failed: {msg}") from exc


def pull_rebase(repo: Repo, source: Source) -> None:
    """Fetch + rebase the source branch onto origin."""
    branch = source.branch or "main"
    with _authed_remote(repo, source):
        try:
            repo.remotes.origin.fetch()
            repo.git.rebase(f"origin/{branch}")
        except GitCommandError as exc:
            raise GitOpError(f"Pull/rebase failed: {exc}") from exc


def commit_paths(
    repo: Repo,
    paths: list[Path | str],
    message: str,
    author_name: str = "core-framework",
    author_email: str = "noreply@core-framework.local",
) -> CommitResult:
    """Stage ``paths`` (relative to repo root) and commit."""
    rel_paths = [str(Path(p)) for p in paths]
    repo.index.add(rel_paths)
    if not repo.is_dirty(index=True, working_tree=False, untracked_files=False):
        return CommitResult(sha="", message=message, files_changed=0, nothing_to_commit=True)
    actor = f"{author_name} <{author_email}>"
    try:
        commit = repo.index.commit(message, author=actor, committer=actor)  # type: ignore[arg-type]
    except GitCommandError as exc:
        raise GitOpError(f"Commit failed: {exc}") from exc
    return CommitResult(
        sha=commit.hexsha,
        message=message,
        files_changed=len(rel_paths),
    )


def push(repo: Repo, source: Source) -> None:
    """Push current branch to origin."""
    branch = source.branch or "main"
    with _authed_remote(repo, source):
        try:
            result = repo.remotes.origin.push(branch)
            for info in result:
                if info.flags & info.ERROR:
                    raise GitOpError(f"Push rejected: {info.summary.strip()}")
        except GitCommandError as exc:
            raise GitOpError(f"Push failed: {exc}") from exc
