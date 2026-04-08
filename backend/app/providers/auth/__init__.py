from functools import lru_cache

from app.config import settings
from app.providers.auth.base import AuthProvider


@lru_cache(maxsize=1)
def get_auth_provider() -> AuthProvider:
    """Factory that returns the configured auth provider (cached singleton)."""
    match settings.auth_provider:
        case "azure" | "entra":
            from app.providers.auth.entra import EntraAuthProvider

            return EntraAuthProvider()
        case "none":
            from app.providers.auth.no_auth import NoAuthProvider

            return NoAuthProvider()
        case _:
            raise ValueError(f"Unknown auth provider: {settings.auth_provider}")
