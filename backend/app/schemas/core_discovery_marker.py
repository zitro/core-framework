"""Pydantic model for the customer-repo-root marker file.

``core-discovery.json`` is the visible (non-dotfile) machine signal
that identifies a directory as a CORE Discovery customer repo, plus
the contract metadata the upgrade-mode planner needs.

``framework_version_pinned`` is REQUIRED to be a concrete SemVer tag
— ``latest``, ``main``, ``master``, or ``edge`` are refused. The
marker is what the CLI emits at scaffold time (new mode) and reads
on upgrade.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(-[\w.-]+)?(\+[\w.-]+)?$")
_FLOATING_TAGS = frozenset({"latest", "main", "master", "edge"})


def _assert_semver(value: str, field_name: str) -> None:
    """Raise ValueError if ``value`` is not a concrete SemVer tag."""
    if not _SEMVER_RE.match(value):
        raise ValueError(f"{field_name} must match SemVer (e.g. 1.4.0); got {value!r}.")


class CoreDiscoveryMarker(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0.0"] = "1.0.0"
    customer_slug: str = Field(pattern=r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
    display_name: str = Field(min_length=1)
    cli_version_created: str = Field(min_length=1)
    cli_version_last_upgrade: str | None = None
    framework_version_pinned: str = Field(min_length=1)
    created_at: datetime
    last_upgrade_at: datetime | None = None
    files_managed: list[str] = Field(default_factory=list)

    @field_validator("framework_version_pinned")
    @classmethod
    def _refuse_floating_tags(cls, value: str) -> str:
        if value.lower() in _FLOATING_TAGS:
            raise ValueError(
                "framework_version_pinned must be a concrete SemVer tag, "
                f"not a floating reference like {value!r}."
            )
        _assert_semver(value, "framework_version_pinned")
        return value

    @field_validator("cli_version_created")
    @classmethod
    def _cli_created_is_semver(cls, value: str) -> str:
        _assert_semver(value, "cli_version_created")
        return value

    @field_validator("cli_version_last_upgrade")
    @classmethod
    def _cli_upgrade_is_semver_or_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        _assert_semver(value, "cli_version_last_upgrade")
        return value
