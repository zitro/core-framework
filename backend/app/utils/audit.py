"""Audit attribution helpers.

Stamps `created_by` / `updated_by` on records using the active user's claims,
which are propagated via a ContextVar that the auth dependency sets per-request.
Callers don't need to pass claims explicitly — they just call `stamp_create`
or `stamp_update` before persisting.
"""

from __future__ import annotations

from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

current_user: ContextVar[dict | None] = ContextVar("current_user", default=None)


def user_label(claims: dict | None) -> str:
    """Pick a stable human label from token claims."""
    if not claims:
        return ""
    for key in ("preferred_username", "upn", "email", "name", "sub"):
        value = claims.get(key)
        if value:
            return str(value)
    return ""


def stamp_create(item: dict[str, Any]) -> dict[str, Any]:
    """Stamp `created_by` and `updated_by` from the active request user."""
    label = user_label(current_user.get())
    if label:
        item.setdefault("created_by", label)
        item.setdefault("updated_by", label)
    return item


def stamp_update(updates: dict[str, Any]) -> dict[str, Any]:
    """Stamp `updated_by` and `updated_at` on a partial update."""
    label = user_label(current_user.get())
    if label:
        updates["updated_by"] = label
    updates.setdefault("updated_at", datetime.now(UTC).isoformat())
    return updates
