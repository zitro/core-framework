"""Per-request project context.

The active project (from the ``X-Project-Id`` header) is propagated through
the request via a ContextVar so storage and audit helpers can scope reads,
writes, and partition-key selection without every router needing to thread
it explicitly.

Set automatically by :func:`app.middleware.project_context_middleware`.
"""

from __future__ import annotations

from contextvars import ContextVar

current_project_id: ContextVar[str | None] = ContextVar("current_project_id", default=None)


def get_current_project_id() -> str | None:
    """Return the active project_id for this request, or None if unset."""
    return current_project_id.get()
