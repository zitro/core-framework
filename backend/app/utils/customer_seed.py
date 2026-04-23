"""Customer seed loader.

On startup, import customer entities (and optionally their sources) from
JSON files mounted under ``CUSTOMER_SEED_DIR`` (default ``/data/seed/customers``).
This keeps customer-specific defaults out of the framework image while still
giving downstream deployments (e.g. core-allstate) a clean way to bootstrap
their customer + sources on first boot.

Schema (one file per customer, ``*.json``):

    {
      "slug": "acme",
      "display_name": "Acme",
      "industry": "Insurance",
      "summary": "Optional one-liner.",
      "sources": [
        {
          "label": "Acme vertex",
          "kind": "github",
          "role": "vertex",
          "location": "owner/repo",
          "branch": "main",
          "writable": true
        }
      ]
    }

Behaviour:
- Idempotent: a customer is created only when no row with the same slug
  exists. Sources are added only when no source with the same label
  exists on that customer.
- Never includes secrets (PATs). Tokens belong in env / .env, not in
  seed files committed to a repo.
- Best-effort: a malformed file is logged and skipped — it never blocks
  startup.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from app.providers.storage import get_storage_provider
from app.utils.audit import stamp_create
from app.utils.slug import slugify

logger = logging.getLogger(__name__)

COLLECTION = "customers"
DEFAULT_SEED_DIR = "/data/seed/customers"


def _seed_dir() -> Path:
    return Path(os.environ.get("CUSTOMER_SEED_DIR", DEFAULT_SEED_DIR))


def _coerce_source(raw: dict[str, Any], next_id: str) -> dict[str, Any] | None:
    label = str(raw.get("label") or "").strip()
    kind = str(raw.get("kind") or "").strip().lower()
    location = str(raw.get("location") or "").strip()
    if not label or not kind or not location:
        return None
    return {
        "id": next_id,
        "label": label,
        "kind": kind,
        "role": str(raw.get("role") or "notes").strip().lower(),
        "location": location,
        "branch": str(raw.get("branch") or "main"),
        "writable": bool(raw.get("writable", False)),
        "pat_encrypted": "",
        "pat_last4": "",
    }


def _next_source_id(sources: list[dict]) -> str:
    nums = [int(s["id"][4:]) for s in sources if str(s.get("id", "")).startswith("src_")]
    nxt = (max(nums) + 1) if nums else 1
    return f"src_{nxt:02d}"


async def seed_customers_from_dir() -> None:
    """Apply every JSON seed file under ``CUSTOMER_SEED_DIR``.

    Safe to call on every boot — operations are idempotent.
    """
    directory = _seed_dir()
    if not directory.is_dir():
        return
    files = sorted(p for p in directory.glob("*.json") if p.is_file())
    if not files:
        return

    storage = get_storage_provider()
    try:
        existing = await storage.list(COLLECTION)
    except Exception:  # noqa: BLE001
        logger.exception("Customer seed: failed to list customers")
        return
    by_slug: dict[str, dict] = {str(c.get("slug") or ""): c for c in existing}

    for path in files:
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            logger.exception("Customer seed: invalid JSON in %s", path)
            continue
        if not isinstance(raw, dict):
            logger.warning("Customer seed: %s is not an object — skipped", path)
            continue
        display_name = str(raw.get("display_name") or "").strip()
        if not display_name:
            logger.warning("Customer seed: %s missing display_name — skipped", path)
            continue
        slug = str(raw.get("slug") or "").strip().lower() or slugify(display_name)

        customer = by_slug.get(slug)
        try:
            if customer is None:
                payload = {
                    "slug": slug,
                    "display_name": display_name,
                    "industry": str(raw.get("industry") or ""),
                    "summary": str(raw.get("summary") or ""),
                    "sources": [],
                }
                customer = await storage.create(COLLECTION, stamp_create(payload))
                by_slug[slug] = customer
                logger.info("Customer seed: created %s (%s)", display_name, slug)

            # Merge sources by label — never overwrite existing rows or PATs.
            seed_sources = raw.get("sources") or []
            if not isinstance(seed_sources, list) or not seed_sources:
                continue
            existing_sources = list(customer.get("sources") or [])
            existing_labels = {str(s.get("label") or "").lower() for s in existing_sources}
            added = 0
            for src_raw in seed_sources:
                if not isinstance(src_raw, dict):
                    continue
                label = str(src_raw.get("label") or "").strip()
                if not label or label.lower() in existing_labels:
                    continue
                next_id = _next_source_id(existing_sources)
                src = _coerce_source(src_raw, next_id)
                if src is None:
                    continue
                existing_sources.append(src)
                existing_labels.add(label.lower())
                added += 1
            if added:
                await storage.update(
                    COLLECTION,
                    str(customer.get("id") or ""),
                    {"sources": existing_sources},
                )
                logger.info("Customer seed: added %d source(s) to %s", added, display_name)
        except Exception:  # noqa: BLE001
            logger.exception("Customer seed: failed to apply %s", path)
