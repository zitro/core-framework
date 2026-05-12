"""Azure OpenAI DALL-E 3 image provider.

Uses the same Azure OpenAI resource as the LLM provider, with a separate
deployment name (``AZURE_OPENAI_IMAGE_DEPLOYMENT``, default ``dall-e-3``).
"""

import logging

from openai import AsyncAzureOpenAI

from app.config import settings
from app.providers.image.base import GeneratedImage, ImageProvider

logger = logging.getLogger(__name__)


class AzureOpenAIImageProvider(ImageProvider):
    name = "azure_openai"

    def __init__(self) -> None:
        if not settings.azure_openai_endpoint:
            raise RuntimeError("AZURE_OPENAI_ENDPOINT must be set when IMAGE_PROVIDER=azure_openai")
        self._client = AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
        )
        self._deployment = settings.azure_openai_image_deployment or "dall-e-3"

    async def generate(self, prompt: str, *, size: str = "1024x1024") -> GeneratedImage:
        # DALL-E 3 only accepts these sizes; coerce silently.
        valid_sizes = {"1024x1024", "1024x1792", "1792x1024"}
        if size not in valid_sizes:
            size = "1024x1024"
        response = await self._client.images.generate(
            model=self._deployment,
            prompt=prompt,
            n=1,
            size=size,
            response_format="url",
        )
        if not response.data:
            raise RuntimeError("Azure OpenAI image response had no data")
        url = response.data[0].url or ""
        return GeneratedImage(url=url, alt_text=prompt, provider=self.name)
