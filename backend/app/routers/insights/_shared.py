from __future__ import annotations

from typing import Literal

from fastapi import HTTPException

from app.providers.storage import get_storage_provider

Phase = Literal["capture", "orchestrate", "refine", "execute"]


async def get_discovery_or_404(discovery_id: str) -> dict:
    storage = get_storage_provider()
    disc = await storage.get("discoveries", discovery_id)
    if not disc:
        raise HTTPException(status_code=404, detail="Discovery not found")
    return disc


async def list_for_discovery(collection: str, discovery_id: str) -> list[dict]:
    storage = get_storage_provider()
    for key in ("discovery_id", "discoveryId"):
        try:
            items = await storage.list(collection, {key: discovery_id})
        except Exception:
            items = []
        if items:
            return items
    return []


async def list_comments_for_project(project_id: str) -> list[dict]:
    if not project_id:
        return []
    storage = get_storage_provider()
    try:
        return await storage.list("artifact_comments", {"project_id": project_id})
    except Exception:
        return []


def project_id_of(disc: dict) -> str:
    return str(disc.get("engagement_id") or disc.get("project_id") or "")


def shorten(text: str, n: int = 140) -> str:
    s = (text or "").strip().replace("\n", " ")
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"
