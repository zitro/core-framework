"""Identity endpoint exposing the authenticated user (or local-dev principal)."""

from fastapi import APIRouter, Depends

from app.config import settings
from app.dependencies import get_current_user

router = APIRouter()


@router.get("")
async def me(claims: dict = Depends(get_current_user)) -> dict:
    """Return the active user principal.

    With auth_provider=none, returns the local-dev principal so the frontend
    can render a consistent header in either mode.
    """
    return {
        "auth_provider": settings.auth_provider,
        "authenticated": settings.auth_provider != "none",
        "sub": claims.get("sub") or claims.get("oid") or "anonymous",
        "name": claims.get("name") or claims.get("preferred_username") or "Local Developer",
        "email": claims.get("preferred_username") or claims.get("email") or "",
        "tenant_id": claims.get("tid") or "",
    }
