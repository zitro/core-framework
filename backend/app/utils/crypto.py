"""Symmetric encryption for at-rest secrets (PATs, API keys).

Uses Fernet (AES-128-CBC + HMAC-SHA-256). Key derived from
``settings.secret_key`` via SHA-256 to produce a stable 32-byte key
regardless of input length, then base64-urlsafe encoded for Fernet.

If ``settings.secret_key`` is empty the module raises on first use — the
deploy is misconfigured. In dev, set ``SECRET_KEY=dev-only-not-for-prod``
in ``.env``.
"""

from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    secret = settings.secret_key
    if not secret:
        raise RuntimeError(
            "SECRET_KEY is not configured. Set SECRET_KEY in .env "
            "(any non-empty string; min 16 chars recommended)."
        )
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Return Fernet ciphertext for ``plaintext`` (UTF-8 string)."""
    if not plaintext:
        return ""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    """Return plaintext for a Fernet ``ciphertext``; '' if empty/invalid."""
    if not ciphertext:
        return ""
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""
