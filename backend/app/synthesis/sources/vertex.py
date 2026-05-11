"""EngagementRepo source adapter.

Reads a project's engagement-repo clone (resolved via ``project.repo_path``)
and emits each markdown file plus the top-level ``engagement-repo.json``
as ``SourceDoc``s.

We walk every markdown file under the repo so initiative-specific
content (transcripts, scoping emails, risk register) is part of the corpus.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from app.synthesis.models import SourceDoc, SourceKind
from app.synthesis.sources.base import SourceAdapter
from app.utils.project_paths import resolve_project_repo_path

logger = logging.getLogger(__name__)

_MAX_FILE_BYTES = 256 * 1024  # skip pathological files
_MAX_TEXT_CHARS = 32 * 1024  # truncate per-file text fed into LLM


class VertexSourceAdapter(SourceAdapter):
    kind = SourceKind.VERTEX.value

    async def fetch(self, project: dict) -> list[SourceDoc]:
        repo_path = project.get("repo_path") or ""
        if not repo_path:
            return []

        try:
            root = resolve_project_repo_path(repo_path)
        except Exception:
            logger.exception("engagement-repo: failed to resolve repo_path=%s", repo_path)
            return []

        if not root.exists() or not root.is_dir():
            logger.info("engagement-repo: repo not found at %s", root)
            return []

        docs: list[SourceDoc] = []
        docs.extend(self._read_vertex_json(root))
        docs.extend(self._read_markdown_tree(root))
        return docs

    def _read_vertex_json(self, root: Path) -> list[SourceDoc]:
        path = root / "engagement-repo.json"
        if not path.exists():
            return []
        try:
            raw = path.read_text(encoding="utf-8")
            data = json.loads(raw)
        except Exception:
            logger.exception("engagement-repo: failed to read engagement-repo.json at %s", path)
            return []
        title = str(data.get("name") or data.get("customer") or "engagement-repo.json")
        return [
            SourceDoc(
                id="engagement-repo:engagement-repo.json",
                kind=SourceKind.VERTEX,
                title=f"engagement-repo.json — {title}",
                uri=str(path),
                snippet=raw[:400],
                text=raw[:_MAX_TEXT_CHARS],
                metadata={"file": "engagement-repo.json"},
            )
        ]

    def _read_markdown_tree(self, root: Path) -> list[SourceDoc]:
        out: list[SourceDoc] = []
        for path in sorted(root.rglob("*.md")):
            if not path.is_file():
                continue
            try:
                if path.stat().st_size > _MAX_FILE_BYTES:
                    continue
                text = path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                logger.warning("engagement-repo: failed to read %s", path)
                continue
            rel = path.relative_to(root).as_posix()
            title = self._title_from(text) or rel
            out.append(
                SourceDoc(
                    id=f"engagement-repo:{rel}",
                    kind=SourceKind.VERTEX,
                    title=title,
                    uri=str(path),
                    snippet=self._snippet(text),
                    text=text[:_MAX_TEXT_CHARS],
                    last_modified=self._mtime_iso(path),
                    metadata={"path": rel},
                )
            )
        return out

    @staticmethod
    def _title_from(text: str) -> str:
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                return stripped.lstrip("# ").strip()
            if stripped:
                return stripped[:120]
        return ""

    @staticmethod
    def _snippet(text: str) -> str:
        for line in text.splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                return stripped[:400]
        return text[:400]

    @staticmethod
    def _mtime_iso(path: Path) -> str:
        try:
            ts = path.stat().st_mtime
            return datetime.fromtimestamp(ts, tz=UTC).isoformat()
        except Exception:
            return ""
