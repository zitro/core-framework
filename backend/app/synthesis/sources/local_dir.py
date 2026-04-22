"""Local-directory source adapter.

Pulls additional files from arbitrary directories listed on the project under
``project.metadata.local_dirs`` (list of paths) or under
``project.tags`` entries shaped like ``localdir:<path>``.

Supported file types: .md, .txt, .json, .yaml, .yml. Anything else is
deliberately ignored to keep the corpus signal-dense.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.synthesis.models import SourceDoc, SourceKind
from app.synthesis.sources.base import SourceAdapter

logger = logging.getLogger(__name__)

_ALLOWED_SUFFIXES = {".md", ".txt", ".json", ".yaml", ".yml"}
_MAX_FILE_BYTES = 256 * 1024
_MAX_TEXT_CHARS = 32 * 1024


class LocalDirSourceAdapter(SourceAdapter):
    kind = SourceKind.LOCAL_DIR.value

    async def fetch(self, project: dict) -> list[SourceDoc]:
        dirs = self._collect_dirs(project)
        if not dirs:
            return []

        out: list[SourceDoc] = []
        for d in dirs:
            root = Path(d).expanduser()
            if not root.exists() or not root.is_dir():
                logger.info("local_dir: skip missing %s", root)
                continue
            out.extend(self._walk(root))
        return out

    @staticmethod
    def _collect_dirs(project: dict) -> list[str]:
        dirs: list[str] = []
        meta = project.get("metadata") or {}
        for d in meta.get("local_dirs", []) or []:
            if isinstance(d, str) and d.strip():
                dirs.append(d.strip())
        for tag in project.get("tags", []) or []:
            if isinstance(tag, str) and tag.startswith("localdir:"):
                dirs.append(tag.split(":", 1)[1].strip())
        # de-dup, preserve order
        seen: set[str] = set()
        unique: list[str] = []
        for d in dirs:
            if d not in seen:
                seen.add(d)
                unique.append(d)
        return unique

    def _walk(self, root: Path) -> list[SourceDoc]:
        out: list[SourceDoc] = []
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            if path.suffix.lower() not in _ALLOWED_SUFFIXES:
                continue
            try:
                if path.stat().st_size > _MAX_FILE_BYTES:
                    continue
                text = path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                logger.warning("local_dir: failed to read %s", path)
                continue
            rel = path.relative_to(root).as_posix()
            out.append(
                SourceDoc(
                    id=f"local:{root.name}/{rel}",
                    kind=SourceKind.LOCAL_DIR,
                    title=rel,
                    uri=str(path),
                    snippet=text[:400],
                    text=text[:_MAX_TEXT_CHARS],
                    metadata={"root": str(root), "path": rel},
                )
            )
        return out
