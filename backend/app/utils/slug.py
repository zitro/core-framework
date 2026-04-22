"""Slug derivation for project identifiers — URL-safe, filesystem-safe."""

from __future__ import annotations

import re

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_TRIM = re.compile(r"^-+|-+$")


def slugify(value: str, fallback: str = "project") -> str:
    """Convert a free-form name into a stable URL- and FS-safe slug.

    - lowercased
    - non-alphanumeric runs collapsed to a single hyphen
    - leading/trailing hyphens stripped
    - falls back to ``fallback`` if the result would be empty
    - capped at 64 chars (Cosmos partition key practical limit)
    """
    if not value:
        return fallback
    out = _NON_ALNUM.sub("-", value.lower())
    out = _TRIM.sub("", out)
    if not out:
        return fallback
    return out[:64]
