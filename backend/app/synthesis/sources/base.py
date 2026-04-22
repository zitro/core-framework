"""Source adapter contract.

A ``SourceAdapter`` knows how to turn a project + its configuration into a
list of ``SourceDoc``s. Adapters must be cheap to call repeatedly — caching
and incremental refresh live higher up in ``corpus.py``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.synthesis.models import SourceDoc


class SourceAdapter(ABC):
    """Pluggable corpus source."""

    kind: str  # short identifier, matches SourceKind values

    @property
    def enabled(self) -> bool:
        return True

    @abstractmethod
    async def fetch(self, project: dict) -> list[SourceDoc]:
        """Return all source docs this adapter can find for ``project``.

        ``project`` is the engagement record (already resolved from storage)
        so adapters can read things like ``repo_path``, ``customer``, ``tags``.
        """
