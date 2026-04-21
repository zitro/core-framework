"""Per-user rate-limit key.

Keys by Entra `sub` when AUTH_PROVIDER=azure (so a single signed-in user can't
be ratelimited by their colleagues sharing an egress IP), falls back to the
remote address otherwise.
"""

from __future__ import annotations

from fastapi import Request
from slowapi.util import get_remote_address

from app.utils.audit import current_user


def user_or_ip_key(request: Request) -> str:
    claims = current_user.get()
    if claims:
        sub = claims.get("sub") or claims.get("oid")
        if sub:
            return f"user:{sub}"
    return get_remote_address(request)
