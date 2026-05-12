"""Shared router, request schemas, and repo-path resolution helpers."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_current_user
from app.utils.github_oauth_store import get_session
from app.utils.project_paths import resolve_project_repo_path
from app.utils.repo_source import (
    RepoSourceError,
    ensure_github_repo_source,
    is_github_repo_url,
)

router = APIRouter(dependencies=[Depends(get_current_user)])


class RepoPathRequest(BaseModel):
    path: str
    refresh: bool = False


class ExportRequest(BaseModel):
    discovery_id: str
    repo_path: str
    project_dir: str = ""


class IngestClassifyRequest(BaseModel):
    repo_path: str
    content: str


class IngestWriteRequest(BaseModel):
    content_dir: str
    directory: str = ""
    filename: str
    content: str
    action: str = "create"
    append_target: str = ""


class PublishRequest(BaseModel):
    discovery_id: str
    repo_paths: list[str] = []
    dry_run: bool = True
    use_ai_placement: bool = True


class SourceDeleteRequest(BaseModel):
    discovery_id: str
    source_type: str
    source_value: str
    purge_cached_data: bool = True


def github_token_from_request(request: Request) -> str | None:
    """Return GitHub token from explicit header, else OAuth session cookie."""
    explicit = str(request.headers.get("x-github-token", "")).strip()
    if explicit:
        return explicit
    sid = request.cookies.get(settings.github_oauth_cookie_name)
    session = get_session(sid)
    if not session:
        return None
    token, _login = session
    return token


def resolve_repo_root(
    source: str,
    github_token: str | None = None,
    *,
    refresh: bool = False,
) -> Path:
    value = str(source or "").strip()
    if is_github_repo_url(value):
        try:
            return ensure_github_repo_source(value, oauth_token=github_token, refresh=refresh)
        except RepoSourceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return resolve_project_repo_path(value)
