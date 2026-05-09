"""In-memory GitHub OAuth state/session store.

This intentionally keeps credentials runtime-only and local to the current
backend process. Nothing is written to source-controlled files.
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass
from threading import Lock


@dataclass
class _StateEntry:
    expires_at: float


@dataclass
class _SessionEntry:
    access_token: str
    login: str
    expires_at: float


_state_lock = Lock()
_session_lock = Lock()
_states: dict[str, _StateEntry] = {}
_sessions: dict[str, _SessionEntry] = {}


def _purge_expired() -> None:
    now = time.time()
    with _state_lock:
        for key, value in list(_states.items()):
            if value.expires_at <= now:
                _states.pop(key, None)
    with _session_lock:
        for key, value in list(_sessions.items()):
            if value.expires_at <= now:
                _sessions.pop(key, None)


def create_state(ttl_seconds: int = 600) -> str:
    _purge_expired()
    token = secrets.token_urlsafe(32)
    with _state_lock:
        _states[token] = _StateEntry(expires_at=time.time() + max(ttl_seconds, 60))
    return token


def consume_state(state: str) -> bool:
    _purge_expired()
    with _state_lock:
        entry = _states.pop(state, None)
    return entry is not None


def create_session(access_token: str, login: str, ttl_seconds: int) -> str:
    _purge_expired()
    sid = secrets.token_urlsafe(32)
    with _session_lock:
        _sessions[sid] = _SessionEntry(
            access_token=access_token,
            login=login,
            expires_at=time.time() + max(ttl_seconds, 300),
        )
    return sid


def get_session(sid: str | None) -> tuple[str, str] | None:
    if not sid:
        return None
    _purge_expired()
    with _session_lock:
        entry = _sessions.get(sid)
    if not entry:
        return None
    return entry.access_token, entry.login


def delete_session(sid: str | None) -> None:
    if not sid:
        return
    with _session_lock:
        _sessions.pop(sid, None)
