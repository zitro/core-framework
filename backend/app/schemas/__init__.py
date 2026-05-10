"""Pydantic-as-source-of-truth schemas for on-disk file shapes.

Every file the framework writes to a customer repo that needs
machine-readable validation lives here as a Pydantic model. JSON
Schema artifacts (consumed by the TypeScript CLI for client-side
validation) and TypeScript types are generated from these models
via ``scripts/gen-schemas.mjs``. The generated artifacts are
committed to the repo and gated by a CI drift check, so a Pydantic
edit that isn't accompanied by a regen breaks the build instead of
silently shipping inconsistent contracts.
"""

from app.schemas._constants import KNOWN_KINDS

__all__ = ["KNOWN_KINDS"]
