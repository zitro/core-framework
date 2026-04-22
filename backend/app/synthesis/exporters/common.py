"""Render-friendly view helpers shared by all exporters."""

from __future__ import annotations

from typing import Any

from app.synthesis.categories import CATEGORY_LABELS, CATEGORY_ORDER, Category
from app.synthesis.models import Artifact


def group_by_category(artifacts: list[Artifact]) -> dict[Category, list[Artifact]]:
    """Group artifacts by category in the canonical category order."""
    grouped: dict[Category, list[Artifact]] = {c: [] for c in CATEGORY_ORDER}
    for a in artifacts:
        if a.category in grouped:
            grouped[a.category].append(a)
    return grouped


def category_label(category: Category) -> str:
    return CATEGORY_LABELS.get(category, str(category))


def body_to_lines(body: dict[str, Any]) -> list[tuple[str, str]]:
    """Flatten a body dict to (label, value) pairs for prose rendering."""
    out: list[tuple[str, str]] = []
    for key, value in body.items():
        label = key.replace("_", " ").strip().capitalize()
        out.append((label, _stringify(value)))
    return out


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, dict):
                parts.append(", ".join(f"{k}: {_stringify(v)}" for k, v in item.items()))
            else:
                parts.append(_stringify(item))
        return "\n".join(f"- {p}" for p in parts if p)
    if isinstance(value, dict):
        return "\n".join(f"- {k}: {_stringify(v)}" for k, v in value.items())
    return str(value)


def list_items(value: Any) -> list[Any]:
    """Best-effort coercion to a list for slide bullet rendering."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def short(value: Any, limit: int = 220) -> str:
    s = _stringify(value)
    if len(s) <= limit:
        return s
    return s[: limit - 1].rstrip() + "…"
