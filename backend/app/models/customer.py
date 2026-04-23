"""Customer + Source models for v2.2 multi-source workspace.

A Customer groups one or more Engagements (projects) and owns a list of
Sources. A Source is a connected content location — a GitHub repo (vertex
or otherwise), a local folder, or a plain folder mounted into the app.
Sources can be readable (for capture/orient grounding) and/or writable
(targets for "push to vertex" from /execute).

PATs are stored encrypted (Fernet) and never returned by the API; only the
last 4 characters surface for UI confirmation.
"""

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(UTC)


class SourceKind(StrEnum):
    GITHUB = "github"  # remote git repo; clone + pull + push
    LOCAL = "local"  # already-cloned git repo on disk
    FOLDER = "folder"  # plain folder, no git semantics


class SourceRole(StrEnum):
    VERTEX = "vertex"  # follows vertex spec (`{repo}/{customer-slug}/`)
    CORE = "core"  # core-framework overlay (`{repo}/projects/`)
    NOTES = "notes"  # ad-hoc notes/docs
    REFERENCE = "reference"  # read-only methodology / playbooks


class Source(BaseModel):
    id: str = ""
    label: str
    kind: SourceKind
    role: SourceRole = SourceRole.NOTES
    location: str  # `<owner>/<repo>` for github, absolute path for local/folder
    branch: str = "main"  # github only
    writable: bool = False
    pat_encrypted: str = ""  # Fernet ciphertext; never returned to clients
    pat_last4: str = ""  # last 4 chars of plaintext PAT, for UI confirmation
    last_synced_at: datetime | None = None
    last_sync_status: str = ""  # "ok" | "error: <message>"


class SourceCreate(BaseModel):
    """Create payload — accepts plaintext PAT, encrypted server-side."""

    label: str
    kind: SourceKind
    role: SourceRole = SourceRole.NOTES
    location: str
    branch: str = "main"
    writable: bool = False
    pat: str = ""  # plaintext; encrypted before persistence


class SourceUpdate(BaseModel):
    label: str | None = None
    role: SourceRole | None = None
    branch: str | None = None
    writable: bool | None = None
    pat: str | None = None  # if provided, re-encrypt and replace


class Customer(BaseModel):
    """A customer (e.g. Allstate). Groups Engagements and owns Sources."""

    id: str = ""
    slug: str  # kebab-case; matches vertex repo subdir convention
    display_name: str
    industry: str = ""
    summary: str = ""
    sources: list[Source] = Field(default_factory=list)
    created_by: str = ""
    updated_by: str = ""
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class CustomerCreate(BaseModel):
    slug: str = ""  # auto-derived from display_name if blank
    display_name: str
    industry: str = ""
    summary: str = ""


class CustomerUpdate(BaseModel):
    slug: str | None = None
    display_name: str | None = None
    industry: str | None = None
    summary: str | None = None


def redact_source(source: Source | dict) -> dict:
    """Strip pat_encrypted from a Source before returning it."""
    data = source.model_dump(mode="json") if isinstance(source, Source) else dict(source)
    data.pop("pat_encrypted", None)
    return data


def redact_customer(customer: Customer | dict) -> dict:
    """Strip secrets from all sources on a customer."""
    data = customer.model_dump(mode="json") if isinstance(customer, Customer) else dict(customer)
    data["sources"] = [redact_source(s) for s in data.get("sources", [])]
    return data
