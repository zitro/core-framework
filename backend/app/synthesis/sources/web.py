"""Web URL source adapter.

Fetches a small list of URLs and turns each into a `SourceDoc`. Strips
HTML to plain text via stdlib only — no extra deps. Per-project config
under ``project.metadata.sources.web``:

    {
        "urls": [
            {"url": "https://example.com/docs/x", "title": "X"},
            "https://example.com/y"
        ]
    }

Each URL becomes one doc. Useful for product docs, blog posts, public
roadmap pages — anything the customer points us at as required reading.
"""

from __future__ import annotations

import logging
import re
from html import unescape
from html.parser import HTMLParser

import httpx

from app.synthesis.models import SourceDoc, SourceKind
from app.synthesis.sources.base import SourceAdapter

logger = logging.getLogger(__name__)

_MAX_TEXT_CHARS = 32 * 1024
_USER_AGENT = "core-framework-synthesis/1.x"
_DROP_TAGS = {"script", "style", "noscript", "svg", "head"}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._title: str = ""
        self._in_title = False
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in _DROP_TAGS:
            self._skip_depth += 1
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in _DROP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title += data
            return
        if self._skip_depth > 0:
            return
        self._chunks.append(data)

    @property
    def title(self) -> str:
        return self._title.strip()

    @property
    def text(self) -> str:
        joined = " ".join(c.strip() for c in self._chunks if c.strip())
        return re.sub(r"\s+", " ", unescape(joined)).strip()


class WebSourceAdapter(SourceAdapter):
    kind = SourceKind.WEB.value

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    async def fetch(self, project: dict) -> list[SourceDoc]:
        cfg = ((project.get("metadata") or {}).get("sources") or {}).get("web") or {}
        items = cfg.get("urls") or []
        if not items:
            return []

        own = self._client is None
        client = self._client or httpx.AsyncClient(timeout=15.0, follow_redirects=True)
        try:
            docs: list[SourceDoc] = []
            for item in items:
                if isinstance(item, str):
                    url, title_hint = item, ""
                else:
                    url = (item.get("url") or "").strip()
                    title_hint = (item.get("title") or "").strip()
                if not url:
                    continue
                try:
                    doc = await self._fetch_one(client, url, title_hint)
                    if doc:
                        docs.append(doc)
                except Exception:
                    logger.exception("web adapter: %s failed", url)
            return docs
        finally:
            if own:
                await client.aclose()

    async def _fetch_one(
        self,
        client: httpx.AsyncClient,
        url: str,
        title_hint: str,
    ) -> SourceDoc | None:
        r = await client.get(url, headers={"User-Agent": _USER_AGENT})
        if r.status_code != 200:
            logger.warning("web fetch %s -> %s", url, r.status_code)
            return None
        ctype = r.headers.get("content-type", "")
        if "html" in ctype.lower():
            parser = _TextExtractor()
            parser.feed(r.text)
            text = parser.text
            title = title_hint or parser.title or url
        else:
            # plain text / markdown / json — keep as-is
            text = r.text
            title = title_hint or url.rsplit("/", 1)[-1] or url

        if not text.strip():
            return None
        text = text[:_MAX_TEXT_CHARS]
        return SourceDoc(
            id=f"web:{url}",
            kind=SourceKind.WEB,
            title=title,
            uri=url,
            snippet=text[:300],
            text=text,
            metadata={"content_type": ctype},
        )
