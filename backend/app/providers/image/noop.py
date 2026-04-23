"""No-op image provider — returned when IMAGE_PROVIDER=none.

Lets storyboard endpoints work without erroring; callers should check the
returned ``url == ""`` to decide whether to render a placeholder.
"""

from __future__ import annotations

from app.providers.image.base import GeneratedImage, ImageProvider


class NoopImageProvider(ImageProvider):
    name = "none"

    async def generate(self, prompt: str, *, size: str = "1024x1024") -> GeneratedImage:
        return GeneratedImage(url="", alt_text=prompt, provider=self.name)
