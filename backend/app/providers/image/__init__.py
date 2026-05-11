"""Image generation provider factory.

Configured by ``IMAGE_PROVIDER`` env var:
- ``local``        (default) deterministic SVG placeholder, no network
- ``azure_openai`` DALL-E 3 on configured Azure OpenAI resource
- ``none``         returns no image (empty url)
"""

from functools import lru_cache

from app.config import settings
from app.providers.image.base import GeneratedImage, ImageProvider

__all__ = ["GeneratedImage", "ImageProvider", "get_image_provider"]


@lru_cache(maxsize=1)
def get_image_provider() -> ImageProvider:
    """Return the configured image provider (cached singleton)."""
    match settings.image_provider:
        case "azure_openai":
            from app.providers.image.azure_openai import AzureOpenAIImageProvider

            return AzureOpenAIImageProvider()
        case "local" | "":
            from app.providers.image.local_svg import LocalSVGImageProvider

            return LocalSVGImageProvider()
        case "none":
            from app.providers.image.noop import NoopImageProvider

            return NoopImageProvider()
        case _:
            raise ValueError(f"Unknown IMAGE_PROVIDER: {settings.image_provider}")
