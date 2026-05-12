"""Engagement repo integration — reads a structured markdown knowledge base.

Public surface re-exported from concern-specific submodules so existing
``from app.utils.engagement import X`` imports keep working.
"""

from __future__ import annotations

from app.utils.engagement._context import read_engagement_context
from app.utils.engagement._parse import (
    FRONTMATTER_RE,
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
    _find_content_dir,
    _parse_frontmatter,
    _type_to_label,
)
from app.utils.engagement._scan import (
    read_engagement_content_structured,
    scan_engagement_repo,
)

__all__ = [
    "FRONTMATTER_RE",
    "MAX_FILE_SIZE",
    "MAX_TOTAL_SIZE",
    "_find_content_dir",
    "_parse_frontmatter",
    "_type_to_label",
    "read_engagement_content_structured",
    "read_engagement_context",
    "scan_engagement_repo",
]
