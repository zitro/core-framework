from abc import ABC, abstractmethod

from fastapi import Request


class AuthProvider(ABC):
    """Abstract base for authentication/authorization."""

    @abstractmethod
    async def validate_request(self, request: Request) -> dict | None:
        """Validate a request and return user claims, or None if unauthenticated."""
