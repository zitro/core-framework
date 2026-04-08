"""Auth dependency for FastAPI route protection."""

from fastapi import Depends, HTTPException, Request

from app.providers.auth import get_auth_provider
from app.providers.auth.base import AuthProvider


async def get_current_user(
    request: Request,
    auth: AuthProvider = Depends(get_auth_provider),
) -> dict:
    """Validate the request and return user claims.

    Returns user claims dict on success, raises 401 on failure.
    The NoAuthProvider always returns a local-dev user, so this
    is transparent in development.
    """
    claims = await auth.validate_request(request)
    if claims is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return claims
