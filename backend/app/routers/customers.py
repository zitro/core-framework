"""Customers router (v2.2) — customer entities + their multi-source list.

A Customer groups Engagements (projects) and owns a list of connected Sources.
Sources are how the app reads/writes content: GitHub repos (vertex or other),
local clones, or plain folders.

PATs are stored Fernet-encrypted via :mod:`app.utils.crypto` and never
returned by the API. ``GET`` responses include a ``pat_last4`` confirmation
field so the UI can show "ghp_…AbCd".
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.dependencies import get_current_user
from app.models.customer import (
    CustomerCreate,
    CustomerUpdate,
    Source,
    SourceCreate,
    SourceKind,
    SourceUpdate,
    redact_customer,
    redact_source,
)
from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create, stamp_update
from app.utils.audit_log import audit
from app.utils.crypto import encrypt_secret
from app.utils.git_ops import GitOpError, ensure_clone, pull_rebase
from app.utils.slug import slugify
from app.utils.workspace import resolve_source_projects, source_root

router = APIRouter(dependencies=[Depends(get_current_user)])
COLLECTION = "customers"


async def _ensure_unique_slug(base: str, exclude_id: str = "") -> str:
    storage = get_storage_provider()
    existing = await storage.list(COLLECTION)
    taken = {
        str(c.get("slug", "")).lower()
        for c in existing
        if c.get("id") != exclude_id and c.get("slug")
    }
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def _next_source_id(sources: list[dict]) -> str:
    nums = [int(s["id"][4:]) for s in sources if s.get("id", "").startswith("src_")]
    nxt = (max(nums) + 1) if nums else 1
    return f"src_{nxt:02d}"


@router.post("/", status_code=201)
async def create_customer(payload: CustomerCreate) -> dict:
    storage = get_storage_provider()
    raw = payload.model_dump(mode="json")
    slug = raw.get("slug") or slugify(raw["display_name"])
    raw["slug"] = await _ensure_unique_slug(slug)
    raw["sources"] = []
    item = await storage.create(COLLECTION, stamp_create(raw))
    await audit(
        "create",
        collection=COLLECTION,
        item_id=str(item.get("id", "")),
        summary=item.get("display_name", ""),
        after=item,
    )
    return redact_customer(item)


@router.get("/")
async def list_customers() -> list[dict]:
    storage = get_storage_provider()
    items = await storage.list(COLLECTION)
    return [redact_customer(c) for c in items]


@router.get("/{customer_id}")
async def get_customer(customer_id: str) -> dict:
    storage = get_storage_provider()
    item = await storage.get(COLLECTION, customer_id)
    if not item:
        raise HTTPException(status_code=404, detail="Customer not found")
    return redact_customer(item)


@router.patch("/{customer_id}")
async def update_customer(customer_id: str, updates: CustomerUpdate) -> dict:
    storage = get_storage_provider()
    data = updates.model_dump(exclude_none=True, mode="json")
    if not data:
        raise HTTPException(status_code=422, detail="No valid fields to update")
    if "slug" in data:
        data["slug"] = await _ensure_unique_slug(slugify(data["slug"]), exclude_id=customer_id)
    stamp_update(data)
    try:
        item = await storage.update(COLLECTION, customer_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Customer not found") from exc
    await audit(
        "update",
        collection=COLLECTION,
        item_id=customer_id,
        summary=",".join(sorted(data.keys())),
        after=item,
    )
    return redact_customer(item)


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str) -> dict:
    storage = get_storage_provider()
    existing = await storage.get(COLLECTION, customer_id)
    deleted = await storage.delete(COLLECTION, customer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Customer not found")
    await audit(
        "delete",
        collection=COLLECTION,
        item_id=customer_id,
        summary=(existing or {}).get("display_name", ""),
        before=existing,
    )
    return {"deleted": True}


# ── Source management ────────────────────────────────────


@router.post("/{customer_id}/sources", status_code=201)
async def add_source(customer_id: str, payload: SourceCreate) -> dict:
    storage = get_storage_provider()
    customer = await storage.get(COLLECTION, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sources = list(customer.get("sources") or [])
    src = Source(
        id=_next_source_id(sources),
        label=payload.label,
        kind=payload.kind,
        role=payload.role,
        location=payload.location,
        branch=payload.branch,
        writable=payload.writable,
        pat_encrypted=encrypt_secret(payload.pat) if payload.pat else "",
        pat_last4=payload.pat[-4:] if payload.pat else "",
    )
    sources.append(src.model_dump(mode="json"))
    await storage.update(COLLECTION, customer_id, stamp_update({"sources": sources}))
    await audit(
        "add_source",
        collection=COLLECTION,
        item_id=customer_id,
        summary=f"{src.kind}:{src.label}",
        after={"source_id": src.id},
    )
    return redact_source(src)


@router.patch("/{customer_id}/sources/{source_id}")
async def update_source(customer_id: str, source_id: str, payload: SourceUpdate) -> dict:
    storage = get_storage_provider()
    customer = await storage.get(COLLECTION, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sources = list(customer.get("sources") or [])
    for i, s in enumerate(sources):
        if s.get("id") == source_id:
            updates = payload.model_dump(exclude_none=True, mode="json")
            if "pat" in updates:
                pat = updates.pop("pat")
                s["pat_encrypted"] = encrypt_secret(pat) if pat else ""
                s["pat_last4"] = pat[-4:] if pat else ""
            s.update(updates)
            sources[i] = s
            await storage.update(COLLECTION, customer_id, stamp_update({"sources": sources}))
            await audit(
                "update_source",
                collection=COLLECTION,
                item_id=customer_id,
                summary=f"{source_id}:{','.join(sorted(updates))}",
            )
            return redact_source(s)
    raise HTTPException(status_code=404, detail="Source not found")


@router.delete("/{customer_id}/sources/{source_id}")
async def remove_source(customer_id: str, source_id: str) -> dict:
    storage = get_storage_provider()
    customer = await storage.get(COLLECTION, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sources = list(customer.get("sources") or [])
    new_sources = [s for s in sources if s.get("id") != source_id]
    if len(new_sources) == len(sources):
        raise HTTPException(status_code=404, detail="Source not found")
    await storage.update(COLLECTION, customer_id, stamp_update({"sources": new_sources}))
    await audit(
        "remove_source",
        collection=COLLECTION,
        item_id=customer_id,
        summary=source_id,
    )
    return {"deleted": True}


# ── Source sync (clone-or-pull) ─────────────────────────────


def _sync_source_sync(customer_slug: str, source: Source) -> tuple[str, str]:
    """Blocking helper: clone/pull and return ``(status, projects_path)``."""
    if source.kind == SourceKind.FOLDER:
        projects = str(resolve_source_projects(customer_slug, source))
        return "ok", projects
    target = source_root(customer_slug, source)
    repo = ensure_clone(target, source)
    if source.kind == SourceKind.GITHUB:
        try:
            pull_rebase(repo, source)
        except GitOpError as exc:
            return f"error: {exc}", str(resolve_source_projects(customer_slug, source))
    return "ok", str(resolve_source_projects(customer_slug, source))


@router.post("/{customer_id}/sources/{source_id}/sync")
async def sync_source(customer_id: str, source_id: str) -> dict:
    """Clone (if missing) or pull-rebase the source; persist sync status."""
    storage = get_storage_provider()
    customer = await storage.get(COLLECTION, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sources = list(customer.get("sources") or [])
    src_dict = next((s for s in sources if s.get("id") == source_id), None)
    if not src_dict:
        raise HTTPException(status_code=404, detail="Source not found")
    source = Source(**src_dict)
    customer_slug = str(customer.get("slug", ""))
    try:
        status, projects_path = await run_in_threadpool(_sync_source_sync, customer_slug, source)
    except GitOpError as exc:
        status, projects_path = f"error: {exc}", ""
    src_dict["last_sync_status"] = status
    src_dict["last_synced_at"] = datetime.now(UTC).isoformat()
    for i, s in enumerate(sources):
        if s.get("id") == source_id:
            sources[i] = src_dict
            break
    await storage.update(COLLECTION, customer_id, stamp_update({"sources": sources}))
    await audit(
        "sync_source",
        collection=COLLECTION,
        item_id=customer_id,
        summary=f"{source_id}:{status[:60]}",
    )
    return {
        "status": status,
        "projects_path": projects_path,
        "last_synced_at": src_dict["last_synced_at"],
    }
