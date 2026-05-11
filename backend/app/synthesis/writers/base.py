"""Base classes for synthesis write-back targets."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.synthesis.models import Artifact


@dataclass
class WriteBackResult:
    """Outcome of a write-back attempt."""

    target: str
    enabled: bool
    written: list[str] = field(default_factory=list)  # paths/uris written
    skipped: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "target": self.target,
            "enabled": self.enabled,
            "written": self.written,
            "skipped": self.skipped,
            "errors": self.errors,
        }


class WriteBackTarget(ABC):
    """Pushes generated artifacts back to a system of record."""

    target: str = "base"

    @abstractmethod
    async def push(self, project: dict, artifacts: list[Artifact]) -> WriteBackResult: ...
