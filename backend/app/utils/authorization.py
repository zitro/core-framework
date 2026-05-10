"""Per-request project authorization.

The ``X-Project-Id`` header is set on most authenticated requests by the
frontend. Without enforcement, any authenticated user can read or write
any project's data by changing the header value — this module closes
that gap.

The check runs as part of :func:`app.dependencies.get_current_user`, so
every route that depends on the current user automatically inherits
project-access enforcement.

Transitional design: engagements created before this enforcement landed
have empty ``owners`` lists. We allow access in that case so existing
local-dev data keeps working. Once an engagement has at least one
owner, the gate is enforced strictly. New engagements populate
``owners`` with the creator at write time (see ``create_engagement``).
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.providers.storage import get_storage_provider

ENGAGEMENTS_COLLECTION = "engagements"


def extract_user_id(claims: dict[str, Any]) -> str:
    """Return the stable identifier for the current user.

    Prefers Azure OID (immutable per-tenant), falls back to ``sub``
    (standard JWT subject), then ``email``. Returns "" if none are
    present — callers should treat that as unauthenticated.
    """
    return claims.get("oid") or claims.get("sub") or claims.get("email") or ""


async def assert_project_access(claims: dict[str, Any], project_id: str | None) -> None:
    """Raise 403 if the current user cannot access ``project_id``.

    No-op when ``project_id`` is None (route doesn't scope by project).
    Allows access on engagements with no owners yet (transitional path
    for legacy local-dev data; new engagements always have at least one
    owner).
    """
    if not project_id:
        return

    storage = get_storage_provider()
    engagement = await storage.get(ENGAGEMENTS_COLLECTION, project_id)
    if engagement is None:
        # Unknown project_id: refuse rather than 404 to avoid leaking
        # existence information across tenants.
        raise HTTPException(status_code=403, detail="Project not accessible")

    owners = engagement.get("owners") or []
    if not owners:
        # Legacy engagement created before owner enforcement; allow
        # until the owner field is backfilled.
        return

    user_id = extract_user_id(claims)
    if not user_id or user_id not in owners:
        raise HTTPException(status_code=403, detail="Project not accessible")
