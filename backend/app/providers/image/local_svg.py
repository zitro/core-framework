"""Local SVG image provider — deterministic placeholder, no network.

Renders a simple labeled SVG card from the prompt. Used in dev/CI so the
storyboard UI can be exercised end-to-end without spending Azure credits.
"""

from __future__ import annotations

import base64
import hashlib
from urllib.parse import quote

from app.providers.image.base import GeneratedImage, ImageProvider

_PALETTE = [
    ("#0ea5e9", "#0c4a6e"),  # sky
    ("#f97316", "#7c2d12"),  # orange
    ("#10b981", "#064e3b"),  # emerald
    ("#a855f7", "#581c87"),  # purple
    ("#ef4444", "#7f1d1d"),  # rose
    ("#f59e0b", "#78350f"),  # amber
]


def _palette_for(prompt: str) -> tuple[str, str]:
    """Pick a deterministic palette so the same prompt yields the same colors."""
    digest = hashlib.sha1(prompt.encode("utf-8")).digest()  # noqa: S324
    return _PALETTE[digest[0] % len(_PALETTE)]


def _wrap(text: str, width: int = 28) -> list[str]:
    """Greedy word-wrap so the SVG label stays inside the canvas."""
    words = text.strip().split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:6]


def _svg(prompt: str, size: int) -> str:
    bg, fg = _palette_for(prompt)
    lines = _wrap(prompt)
    line_height = 28
    start_y = size // 2 - (len(lines) - 1) * line_height // 2
    tspans = "".join(
        f'<tspan x="50%" dy="{0 if i == 0 else line_height}">{_xml_escape(line)}</tspan>'
        for i, line in enumerate(lines)
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'width="{size}" height="{size}" role="img">'
        f'<rect width="100%" height="100%" fill="{bg}"/>'
        f'<rect x="16" y="16" width="{size - 32}" height="{size - 32}" '
        f'fill="none" stroke="{fg}" stroke-width="3" rx="12"/>'
        f'<text x="50%" y="{start_y}" text-anchor="middle" '
        f'font-family="Inter, system-ui, sans-serif" font-size="22" '
        f'font-weight="600" fill="{fg}">{tspans}</text>'
        "</svg>"
    )


def _xml_escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


class LocalSVGImageProvider(ImageProvider):
    name = "local"

    async def generate(self, prompt: str, *, size: str = "1024x1024") -> GeneratedImage:
        # Accept "WIDTHxHEIGHT" but render square; callers can scale via CSS.
        try:
            px = int(size.split("x", 1)[0])
        except ValueError:
            px = 1024
        svg = _svg(prompt or "untitled frame", px)
        # Two equivalent encodings exist; base64 is the safest across markdown
        # renderers and srcset.
        encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
        url = f"data:image/svg+xml;base64,{encoded}"
        return GeneratedImage(url=url, alt_text=prompt, provider=self.name)


def svg_data_uri_url_encoded(prompt: str, size: int = 1024) -> str:
    """Helper for non-async callers/tests; URL-encoded data URI."""
    return f"data:image/svg+xml;utf8,{quote(_svg(prompt, size))}"
