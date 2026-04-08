import logging

import jwt
from fastapi import Request

from app.config import settings
from app.providers.auth.base import AuthProvider

logger = logging.getLogger(__name__)

_JWKS_URL = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/discovery/v2.0/keys"
_ISSUER = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0"


class EntraAuthProvider(AuthProvider):
    """Microsoft Entra ID (Azure AD) JWT validation provider."""

    def __init__(self):
        self._jwks_client = jwt.PyJWKClient(_JWKS_URL)

    async def validate_request(self, request: Request) -> dict | None:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=settings.azure_client_id,
                issuer=_ISSUER,
                options={"verify_exp": True},
            )
            return claims
        except jwt.PyJWTError:
            logger.debug("JWT validation failed", exc_info=True)
            return None
