"""Auth dependency for FastAPI route protection."""

from fastapi import Depends, HTTPException, Request

from app.providers.auth import get_auth_provider
from app.providers.auth.base import AuthProvider
from app.utils.audit import current_user
from app.utils.authorization import assert_project_access
from app.utils.project_context import get_current_project_id


async def get_current_user(
    request: Request,
    auth: AuthProvider = Depends(get_auth_provider),
) -> dict:
    """Validate the request and return user claims.

    Returns user claims dict on success, raises 401 on failure or 403
    when the request's ``X-Project-Id`` references a project the user
    does not own. The NoAuthProvider always returns a local-dev user,
    so this is transparent in development. Also publishes the claims
    into a ContextVar so downstream helpers (audit stamping, per-user
    rate limiting) can read them without threading them through every
    call.
    """
    claims = await auth.validate_request(request)
    if claims is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    current_user.set(claims)
    # Enforce per-project access for the X-Project-Id header set by
    # project_context_middleware (no-op when the header is absent or
    # when the engagement has no owners yet — see authorization.py).
    await assert_project_access(claims, get_current_project_id())
    return claims
