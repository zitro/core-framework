"""Abstract base for image generation providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class GeneratedImage:
    """An image produced by a provider.

    ``url`` is a data URI (``data:image/...``) or an ``https://`` URL.
    Providers that do no work return ``url=""`` and the UI renders a
    placeholder. ``alt_text`` is the prompt (or a sanitized version) for a11y.
    """

    url: str
    alt_text: str
    provider: str


class ImageProvider(ABC):
    """Abstract image provider. Implementations must be safe for repeated calls."""

    name: str = "abstract"

    @abstractmethod
    async def generate(self, prompt: str, *, size: str = "1024x1024") -> GeneratedImage:
        """Generate one image from ``prompt`` and return its URL + metadata."""
