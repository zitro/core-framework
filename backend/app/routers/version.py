"""Version + upgrade-check endpoint.

Returns the running framework version and, on a best-effort basis, the
latest published GHCR release tag so the frontend can render an in-app
"update available" banner. The latest-release lookup is cached in-process
for 1 hour and short-circuits to empty on any failure — never blocks UI.
"""

from __future__ import annotations

import logging
import time

import httpx
from fastapi import APIRouter, Depends, Request

from app.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])

_GITHUB_RELEASES_URL = "https://api.github.com/repos/zitro/core-framework/releases/latest"
_CACHE_TTL_SECONDS = 60 * 60  # 1 hour
_cache: dict[str, str | float] = {"tag": "", "fetched_at": 0.0}


async def _latest_release_tag() -> str:
    """Fetch the latest GitHub release tag for the framework.

    Cached in-process. Empty string on any failure (DNS, network, rate
    limit, malformed payload). Never raises.
    """
    now = time.monotonic()
    if (
        _cache.get("tag")
        and isinstance(_cache.get("fetched_at"), float)
        and now - float(_cache["fetched_at"]) < _CACHE_TTL_SECONDS
    ):
        return str(_cache["tag"])
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                _GITHUB_RELEASES_URL,
                headers={"Accept": "application/vnd.github+json"},
            )
        if resp.status_code != 200:
            return ""
        tag = (resp.json() or {}).get("tag_name") or ""
        # Cache even an empty answer so we don't hammer the API.
        _cache["tag"] = tag
        _cache["fetched_at"] = now
        return tag
    except Exception:
        logger.warning("version: latest-release fetch failed", exc_info=True)
        return ""


@router.get("/version")
async def get_version(request: Request) -> dict:
    """Return the running framework version + latest published tag.

    Frontend compares the two and renders an "update available" banner
    when they differ. Both fields are strings; latest may be empty when
    the upstream lookup fails.
    """
    running = request.app.version
    latest = await _latest_release_tag()
    return {
        "running": running,
        "latest": latest.lstrip("v") if latest else "",
        "update_available": bool(latest) and latest.lstrip("v") != running,
    }
