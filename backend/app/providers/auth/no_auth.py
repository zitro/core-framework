from fastapi import Request

from app.providers.auth.base import AuthProvider


class NoAuthProvider(AuthProvider):
    """Pass-through auth for local development. All requests are allowed."""

    async def validate_request(self, request: Request) -> dict | None:
        return {"sub": "local-dev", "name": "Local Developer"}
