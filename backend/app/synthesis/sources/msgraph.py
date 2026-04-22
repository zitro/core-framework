"""Microsoft Graph source adapter.

Wraps the existing ``GraphProvider`` to feed files, mail, and meetings into
the synthesis corpus. Search terms are derived from the project name,
customer, and tags so we don't haul the whole tenant in.

If no Graph provider is configured (``graph_provider=none``) this adapter
yields nothing rather than failing — Graph is optional fuel, not a hard
dependency.
"""

from __future__ import annotations

import logging

from app.providers.graph import get_graph_provider
from app.synthesis.models import SourceDoc, SourceKind
from app.synthesis.sources.base import SourceAdapter

logger = logging.getLogger(__name__)


class MsGraphSourceAdapter(SourceAdapter):
    kind = SourceKind.MS_GRAPH_FILE.value

    @property
    def enabled(self) -> bool:
        try:
            return get_graph_provider().enabled
        except Exception:
            return False

    async def fetch(self, project: dict) -> list[SourceDoc]:
        if not self.enabled:
            return []
        try:
            provider = get_graph_provider()
        except Exception:
            logger.exception("ms_graph: provider lookup failed")
            return []

        queries = self._queries(project)
        out: list[SourceDoc] = []

        for q in queries:
            try:
                files = await provider.search_files(q, limit=8)
            except Exception:
                logger.warning("ms_graph: search_files failed for %r", q, exc_info=True)
                files = []
            for f in files:
                out.append(
                    SourceDoc(
                        id=f"msgraph:file:{f.id}",
                        kind=SourceKind.MS_GRAPH_FILE,
                        title=f.name,
                        uri=f.web_url,
                        snippet=f.snippet,
                        text=f.snippet,
                        last_modified=f.last_modified,
                        metadata={"size": f.size, "query": q},
                    )
                )

            try:
                msgs = await provider.search_messages(q, limit=8)
            except Exception:
                logger.warning("ms_graph: search_messages failed for %r", q, exc_info=True)
                msgs = []
            for m in msgs:
                out.append(
                    SourceDoc(
                        id=f"msgraph:mail:{m.id}",
                        kind=SourceKind.MS_GRAPH_MAIL,
                        title=m.subject or "(no subject)",
                        uri=m.web_url,
                        snippet=m.snippet,
                        text=m.snippet,
                        last_modified=m.received,
                        metadata={"sender": m.sender, "query": q},
                    )
                )

        try:
            meetings = await provider.list_meetings(days=14, limit=20)
        except Exception:
            logger.warning("ms_graph: list_meetings failed", exc_info=True)
            meetings = []
        for mt in meetings:
            out.append(
                SourceDoc(
                    id=f"msgraph:meeting:{mt.id}",
                    kind=SourceKind.MS_GRAPH_MEETING,
                    title=mt.subject or "(no subject)",
                    uri=mt.join_url,
                    snippet=mt.snippet,
                    text=mt.snippet,
                    last_modified=mt.start,
                    metadata={"organizer": mt.organizer, "end": mt.end},
                )
            )

        # de-dup by id, preserve first-seen order
        seen: set[str] = set()
        deduped: list[SourceDoc] = []
        for d in out:
            if d.id in seen:
                continue
            seen.add(d.id)
            deduped.append(d)
        return deduped

    @staticmethod
    def _queries(project: dict) -> list[str]:
        seeds: list[str] = []
        for key in ("name", "customer"):
            v = project.get(key)
            if isinstance(v, str) and v.strip():
                seeds.append(v.strip())
        for tag in project.get("tags", []) or []:
            if isinstance(tag, str) and tag and not tag.startswith("localdir:"):
                seeds.append(tag.strip())
        # unique
        seen: set[str] = set()
        out: list[str] = []
        for s in seeds:
            k = s.lower()
            if k in seen:
                continue
            seen.add(k)
            out.append(s)
        return out[:5]
