"""Vertex repo ingest endpoints (v2.1).

Adds a "drop anything, we'll file it" capability on top of the read-only
vertex tree viewer. Three endpoints:

- ``POST /{project_id}/vertex/extract`` – text from URL or uploaded file
- ``POST /{project_id}/vertex/classify`` – LLM proposes ``dest_path``
- ``POST /{project_id}/vertex/write``    – writes content to the repo

Lives in its own module to keep ``v2.py`` under 300 lines.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.providers.llm import get_llm_provider
from app.routers.v2 import _load_project, _resolve_repo, _safe_join

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

_MAX_INGEST_BYTES = 1 * 1024 * 1024  # 1 MiB cap on ingested content
_MAX_URL_FETCH = 5 * 1024 * 1024  # 5 MiB cap on remote pages
_URL_TIMEOUT = 5.0


# ── extract ──────────────────────────────────────────────────────────────


class ExtractResponse(BaseModel):
    text: str
    source: Literal["paste", "file", "url"]
    filename: str | None = None
    bytes: int


def _extract_pdf(data: bytes) -> str:
    from io import BytesIO

    from pypdf import PdfReader  # lazy

    reader = PdfReader(BytesIO(data))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages)


def _extract_docx(data: bytes) -> str:
    from io import BytesIO

    from docx import Document  # python-docx, lazy

    doc = Document(BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text)


def _extract_html(html: str) -> str:
    import trafilatura  # lazy

    extracted = trafilatura.extract(html, include_comments=False, include_tables=True)
    return (extracted or "").strip()


@router.post("/{project_id}/vertex/extract")
async def vertex_extract(
    project_id: str,
    url: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
) -> dict:
    await _load_project(project_id)
    if not url and not file:
        raise HTTPException(status_code=422, detail="Provide a 'url' or 'file'")

    if url:
        async with httpx.AsyncClient(timeout=_URL_TIMEOUT, follow_redirects=True) as cli:
            try:
                resp = await cli.get(url)
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=502, detail=f"Fetch failed: {exc}") from exc
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"URL returned {resp.status_code}")
        body = resp.content[:_MAX_URL_FETCH]
        ctype = (resp.headers.get("content-type") or "").lower()
        try:
            if "pdf" in ctype:
                text = _extract_pdf(body)
            elif "html" in ctype or "xml" in ctype:
                text = _extract_html(body.decode("utf-8", errors="replace"))
            else:
                text = body.decode("utf-8", errors="replace")
        except Exception as exc:
            logger.exception("vertex_extract: parse failed for %s", url)
            raise HTTPException(status_code=415, detail=f"Could not parse: {exc}") from exc
        return ExtractResponse(text=text[:200_000], source="url", bytes=len(body)).model_dump()

    assert file is not None  # noqa: S101 — validated above
    data = (await file.read())[:_MAX_INGEST_BYTES]
    name = (file.filename or "").lower()
    try:
        if name.endswith(".pdf"):
            text = _extract_pdf(data)
        elif name.endswith(".docx"):
            text = _extract_docx(data)
        elif name.endswith((".html", ".htm")):
            text = _extract_html(data.decode("utf-8", errors="replace"))
        else:
            text = data.decode("utf-8", errors="replace")
    except Exception as exc:
        logger.exception("vertex_extract: parse failed for %s", name)
        raise HTTPException(status_code=415, detail=f"Could not parse: {exc}") from exc
    return ExtractResponse(
        text=text[:200_000], source="file", filename=file.filename, bytes=len(data)
    ).model_dump()


# ── classify ─────────────────────────────────────────────────────────────


class ClassifyRequest(BaseModel):
    content: str = Field(min_length=1, max_length=200_000)
    hint: str | None = None
    filename: str | None = None


class ClassifyResponse(BaseModel):
    dest_path: str
    filename: str
    rationale: str
    confidence: float
    sections_considered: list[str]


def _list_sections(root: Path) -> list[str]:
    """Top-level folders plus their immediate sub-folders, slash-joined."""
    out: list[str] = []
    try:
        for child in root.iterdir():
            if child.is_dir() and not child.name.startswith("."):
                out.append(child.name)
                try:
                    for sub in child.iterdir():
                        if sub.is_dir() and not sub.name.startswith("."):
                            out.append(f"{child.name}/{sub.name}")
                except PermissionError:
                    continue
    except PermissionError:
        pass
    return sorted(out)[:80]


_SLUG_RE = "abcdefghijklmnopqrstuvwxyz0123456789-"


def _slugify(text: str, fallback: str = "note") -> str:
    base = (text or "").lower().strip()
    out = "".join(c if c in _SLUG_RE else "-" for c in base[:80]).strip("-")
    while "--" in out:
        out = out.replace("--", "-")
    return out or fallback


@router.post("/{project_id}/vertex/classify")
async def vertex_classify(project_id: str, payload: ClassifyRequest) -> dict:
    project = await _load_project(project_id)
    root = _resolve_repo(project)
    if not root:
        raise HTTPException(status_code=404, detail="Vertex repo not available")

    sections = _list_sections(root)
    sections_block = "\n".join(f"- {s}" for s in sections) or "(empty repo)"
    snippet = payload.content[:4000]

    system = (
        "You file documents into a structured knowledge repo for a customer "
        "discovery engagement. Pick the best destination folder from the "
        "existing list. If nothing fits well (confidence < 0.4) use 'inbox'. "
        "Return STRICT JSON: "
        '{"dest_path": "folder/subfolder", "filename": "kebab-case.md", '
        '"rationale": "<=280 chars", "confidence": 0.0-1.0}'
    )
    user_prompt = (
        f"Existing folders:\n{sections_block}\n\n"
        f"Hint: {payload.hint or '(none)'}\n"
        f"Original filename: {payload.filename or '(none)'}\n\n"
        f"Content (first 4000 chars):\n---\n{snippet}\n---"
    )

    try:
        result = await get_llm_provider().complete_json(system, user_prompt)
    except Exception as exc:
        logger.exception("vertex_classify: LLM call failed")
        # Safe fallback so the UI is never stuck.
        ts = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        return ClassifyResponse(
            dest_path="inbox",
            filename=f"{ts}-{_slugify(payload.filename or 'note')}.md",
            rationale=f"Classifier unavailable ({exc.__class__.__name__}); routed to inbox.",
            confidence=0.0,
            sections_considered=sections,
        ).model_dump()

    dest = str(result.get("dest_path") or "inbox").strip().strip("/")
    if dest.startswith(".") or ".." in dest:
        dest = "inbox"
    fname = str(result.get("filename") or "").strip()
    if not fname or "/" in fname or fname.startswith("."):
        fname = f"{_slugify(payload.filename or payload.hint or 'note')}.md"
    if not fname.endswith((".md", ".markdown", ".txt", ".json")):
        fname = f"{fname}.md"
    rationale = str(result.get("rationale") or "")[:280]
    try:
        confidence = max(0.0, min(1.0, float(result.get("confidence") or 0.0)))
    except (TypeError, ValueError):
        confidence = 0.0
    if confidence < 0.4:
        dest = "inbox"

    return ClassifyResponse(
        dest_path=dest,
        filename=fname,
        rationale=rationale,
        confidence=confidence,
        sections_considered=sections,
    ).model_dump()


# ── write ────────────────────────────────────────────────────────────────


class WriteRequest(BaseModel):
    path: str = Field(min_length=1, max_length=400)
    content: str = Field(max_length=_MAX_INGEST_BYTES)
    overwrite: bool = False
    source: Literal["paste", "file", "url"] = "paste"
    classifier_confidence: float | None = None


class WriteResponse(BaseModel):
    path: str
    bytes: int
    created: bool


@router.post("/{project_id}/vertex/write")
async def vertex_write(project_id: str, payload: WriteRequest) -> dict:
    project = await _load_project(project_id)
    root = _resolve_repo(project)
    if not root:
        raise HTTPException(status_code=404, detail="Vertex repo not available")

    rel = payload.path.strip().lstrip("/")
    if not rel or rel.startswith(".") or ".." in rel.split("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    target = _safe_join(root, rel)
    if target is None:
        raise HTTPException(status_code=400, detail="Path escapes repo root")

    existed = target.exists()
    if existed and not payload.overwrite:
        raise HTTPException(status_code=409, detail="File exists; pass overwrite=true to replace")

    target.parent.mkdir(parents=True, exist_ok=True)
    data = payload.content.encode("utf-8")
    target.write_bytes(data)

    # Audit log: append-only JSONL at repo root.
    try:
        log_line = json.dumps(
            {
                "ts": datetime.now(UTC).isoformat(),
                "path": rel,
                "source": payload.source,
                "classifier_confidence": payload.classifier_confidence,
                "bytes": len(data),
                "overwrote": existed,
            }
        )
        with (root / ".vertex-log.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(log_line + "\n")
    except OSError:
        logger.exception("vertex_write: audit log append failed")

    return WriteResponse(path=rel, bytes=len(data), created=not existed).model_dump()
