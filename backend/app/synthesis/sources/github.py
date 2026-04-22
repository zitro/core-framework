"""GitHub source adapter.

Reads markdown content from a GitHub repository via the public REST API.
Per-project config under ``project.metadata.sources.github``:

    {
        "repos": [
            {
                "owner": "zitro",
                "repo": "core-framework",
                "ref": "master",          # optional, default master
                "paths": ["docs/", "README.md"],  # optional path filter
                "max_files": 50           # optional, default 50
            }
        ],
        "token": "ghp_..."                # optional; passed via Authorization
    }

Tokens stay in project metadata for now. When AuthN matures we'll move
them to Key Vault — same flow as the MSGraph adapter.

The adapter is a thin wrapper over the GitHub `git/trees` + `contents`
endpoints. It NEVER mutates anything; pure read.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.synthesis.models import SourceDoc, SourceKind
from app.synthesis.sources.base import SourceAdapter

logger = logging.getLogger(__name__)

_API = "https://api.github.com"
_DEFAULT_MAX_FILES = 50
_MAX_TEXT_CHARS = 32 * 1024
_USER_AGENT = "core-framework-synthesis/1.x"


class GitHubSourceAdapter(SourceAdapter):
    kind = SourceKind.GITHUB.value

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    @property
    def enabled(self) -> bool:
        # Always on; per-project config decides whether anything fetches.
        return True

    async def fetch(self, project: dict) -> list[SourceDoc]:
        cfg = ((project.get("metadata") or {}).get("sources") or {}).get("github") or {}
        repos = cfg.get("repos") or []
        if not repos:
            return []
        token = cfg.get("token") or ""
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": _USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        own_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=15.0)
        try:
            out: list[SourceDoc] = []
            for repo_cfg in repos:
                try:
                    out.extend(await self._fetch_repo(client, headers, repo_cfg))
                except Exception:
                    logger.exception("github adapter: repo %s failed", repo_cfg)
            return out
        finally:
            if own_client:
                await client.aclose()

    async def _fetch_repo(
        self,
        client: httpx.AsyncClient,
        headers: dict,
        repo_cfg: dict,
    ) -> list[SourceDoc]:
        owner = (repo_cfg.get("owner") or "").strip()
        repo = (repo_cfg.get("repo") or "").strip()
        if not owner or not repo:
            return []
        ref = (repo_cfg.get("ref") or "master").strip()
        paths = repo_cfg.get("paths") or []
        max_files = int(repo_cfg.get("max_files") or _DEFAULT_MAX_FILES)

        # Tree listing — recursive=1 returns the whole tree in one shot.
        tree_url = f"{_API}/repos/{owner}/{repo}/git/trees/{ref}"
        r = await client.get(tree_url, params={"recursive": "1"}, headers=headers)
        if r.status_code != 200:
            logger.warning("github tree: %s/%s@%s -> %s", owner, repo, ref, r.status_code)
            return []

        tree = r.json().get("tree") or []
        candidates = [
            node
            for node in tree
            if node.get("type") == "blob"
            and node.get("path", "").lower().endswith((".md", ".mdx"))
            and (not paths or any(node["path"].startswith(p) for p in paths))
        ]
        candidates = candidates[:max_files]

        docs: list[SourceDoc] = []
        for node in candidates:
            doc = await self._fetch_blob(client, headers, owner, repo, ref, node)
            if doc:
                docs.append(doc)
        return docs

    async def _fetch_blob(
        self,
        client: httpx.AsyncClient,
        headers: dict,
        owner: str,
        repo: str,
        ref: str,
        node: dict,
    ) -> SourceDoc | None:
        path = node.get("path") or ""
        sha = node.get("sha") or ""
        if not path or not sha:
            return None
        blob_url = f"{_API}/repos/{owner}/{repo}/git/blobs/{sha}"
        r = await client.get(blob_url, headers=headers)
        if r.status_code != 200:
            return None
        body = r.json()
        text = _decode_blob(body)
        if not text:
            return None
        text = text[:_MAX_TEXT_CHARS]
        return SourceDoc(
            id=f"github:{owner}/{repo}@{ref}:{path}",
            kind=SourceKind.GITHUB,
            title=path.rsplit("/", 1)[-1],
            uri=f"https://github.com/{owner}/{repo}/blob/{ref}/{path}",
            snippet=text[:300],
            text=text,
            metadata={"owner": owner, "repo": repo, "ref": ref, "path": path},
        )


def _decode_blob(body: dict[str, Any]) -> str:
    encoding = body.get("encoding") or "base64"
    content = body.get("content") or ""
    if encoding == "base64":
        try:
            raw = base64.b64decode(content)
            return raw.decode("utf-8", errors="replace")
        except Exception:
            return ""
    return str(content)
