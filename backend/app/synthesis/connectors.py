"""Connector marketplace registry.

Static metadata describing every source adapter the platform ships with,
plus the JSON-schema for its per-project config. The frontend uses this
to render a generic "add connector" form without knowing each adapter's
shape ahead of time.

This is metadata only — runtime adapters live under ``sources/``.
"""

from __future__ import annotations

from typing import Any

from app.synthesis.models import SourceKind


def _schema(properties: dict[str, Any], required: list[str] | None = None) -> dict:
    return {
        "type": "object",
        "additionalProperties": True,
        "properties": properties,
        "required": required or [],
    }


CONNECTORS: list[dict[str, Any]] = [
    {
        "kind": SourceKind.VERTEX.value,
        "label": "Vertex repo",
        "description": "Walks the connected vertex repository for markdown content.",
        "config_path": "metadata.repo_path",
        "config_schema": _schema({"repo_path": {"type": "string"}}),
        "builtin": True,
    },
    {
        "kind": SourceKind.LOCAL_DIR.value,
        "label": "Local directory",
        "description": "Reads markdown from a local mount; useful for dev.",
        "config_path": "metadata.sources.local_dir",
        "config_schema": _schema(
            {"path": {"type": "string", "description": "Absolute path"}},
            required=["path"],
        ),
        "builtin": True,
    },
    {
        "kind": SourceKind.MS_GRAPH_FILE.value,
        "label": "Microsoft Graph",
        "description": "Files, mail, and meetings via Microsoft Graph (requires consent).",
        "config_path": "metadata.sources.ms_graph",
        "config_schema": _schema(
            {
                "site_id": {"type": "string"},
                "drive_id": {"type": "string"},
                "user_principal_name": {"type": "string"},
            }
        ),
        "builtin": True,
    },
    {
        "kind": SourceKind.GITHUB.value,
        "label": "GitHub",
        "description": "Markdown content from one or more GitHub repositories.",
        "config_path": "metadata.sources.github",
        "config_schema": _schema(
            {
                "token": {
                    "type": "string",
                    "description": "Optional PAT for private repos / higher rate limits.",
                },
                "repos": {
                    "type": "array",
                    "items": _schema(
                        {
                            "owner": {"type": "string"},
                            "repo": {"type": "string"},
                            "ref": {"type": "string", "default": "master"},
                            "paths": {"type": "array", "items": {"type": "string"}},
                            "max_files": {"type": "integer", "default": 50},
                        },
                        required=["owner", "repo"],
                    ),
                },
            },
            required=["repos"],
        ),
        "builtin": False,
    },
    {
        "kind": SourceKind.WEB.value,
        "label": "Web URLs",
        "description": "Fetches a small list of URLs and strips HTML to plain text.",
        "config_path": "metadata.sources.web",
        "config_schema": _schema(
            {
                "urls": {
                    "type": "array",
                    "items": {
                        "oneOf": [
                            {"type": "string"},
                            _schema(
                                {
                                    "url": {"type": "string"},
                                    "title": {"type": "string"},
                                },
                                required=["url"],
                            ),
                        ],
                    },
                }
            },
            required=["urls"],
        ),
        "builtin": False,
    },
    {
        "kind": SourceKind.HTTP_JSON.value,
        "label": "HTTP JSON",
        "description": (
            "Generic JSON endpoint reader for Jira/ADO/Confluence-style APIs. "
            "Map records to docs via simple dot-paths."
        ),
        "config_path": "metadata.sources.http_json",
        "config_schema": _schema(
            {
                "endpoints": {
                    "type": "array",
                    "items": _schema(
                        {
                            "url": {"type": "string"},
                            "headers": {"type": "object"},
                            "items_path": {
                                "type": "string",
                                "description": "Dot-path to the array of records.",
                            },
                            "id_field": {"type": "string", "default": "id"},
                            "title_field": {"type": "string", "default": "title"},
                            "text_field": {"type": "string", "default": "text"},
                            "uri_field": {"type": "string"},
                            "max_items": {"type": "integer", "default": 100},
                        },
                        required=["url"],
                    ),
                }
            },
            required=["endpoints"],
        ),
        "builtin": False,
    },
]


def list_connectors() -> list[dict[str, Any]]:
    return list(CONNECTORS)
