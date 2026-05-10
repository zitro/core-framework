"""WebSocket hub for real-time collaboration on discoveries."""

import json
import logging
from collections import defaultdict

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.providers.auth import get_auth_provider
from app.providers.storage import get_storage_provider
from app.utils.authorization import assert_project_access

logger = logging.getLogger(__name__)

router = APIRouter()

# Bounds: a collaboration message is small (cursor moves, evidence stubs).
# 64 KiB is generous and protects against memory abuse from oversized frames.
MAX_WS_MESSAGE_BYTES = 64 * 1024
# Cap concurrent connections per discovery room. Real workshops are small;
# anything bigger is almost certainly a runaway client or abuse.
MAX_CONNECTIONS_PER_ROOM = 50

# Whitelist of message types clients are allowed to broadcast. Anything
# outside this set is dropped server-side rather than relayed — a
# defense against malicious clients spoofing system-shaped events
# (e.g. fake `evidence_added` payloads other peers might render as if
# trusted).
ALLOWED_INBOUND_MESSAGE_TYPES = frozenset({"phase_change", "evidence_added", "cursor"})


async def _assert_discovery_access(claims: dict, discovery_id: str) -> bool:
    """True if the authenticated user can access ``discovery_id``.

    Resolves the Discovery's parent project_id and runs the standard
    project-access check. Returns False (rather than raising) so the
    WS handler can close with a policy-violation frame instead of
    surfacing an HTTPException.
    """
    if not discovery_id:
        return False
    storage = get_storage_provider()
    discovery = await storage.get("discoveries", discovery_id)
    if discovery is None:
        return False
    project_id = discovery.get("project_id") or ""
    if not project_id:
        # Discovery exists but is not tied to an engagement (legacy
        # local-dev data). Allow so existing flows don't break.
        return True
    try:
        await assert_project_access(claims, project_id)
    except Exception:
        return False
    return True


async def _validate_ws_token(token: str | None) -> dict | None:
    """Validate a JWT supplied via the `?token=` query param.

    Browsers can't set custom headers on `new WebSocket(...)`, so we accept
    a bearer token via query string. The auth provider's `validate_request`
    expects a `Request`-like object with a `headers` mapping; we synthesise
    one from the token.
    """

    auth = get_auth_provider()

    class _FakeRequest:
        def __init__(self, value: str | None) -> None:
            self.headers = {"Authorization": f"Bearer {value}"} if value else {}

    return await auth.validate_request(_FakeRequest(token))


class ConnectionManager:
    """Manages active WebSocket connections per discovery room."""

    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, discovery_id: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms[discovery_id].append(websocket)
        count = len(self.rooms[discovery_id])
        logger.info("WS connect: discovery=%s connections=%d", discovery_id, count)
        await self.broadcast(
            discovery_id,
            {
                "type": "presence",
                "active_users": count,
            },
        )

    def disconnect(self, discovery_id: str, websocket: WebSocket):
        self.rooms[discovery_id].remove(websocket)
        count = len(self.rooms[discovery_id])
        if count == 0:
            del self.rooms[discovery_id]
        logger.info("WS disconnect: discovery=%s connections=%d", discovery_id, count)

    async def broadcast(self, discovery_id: str, message: dict, exclude: WebSocket | None = None):
        """Send a message to all connections in a discovery room."""
        dead: list[WebSocket] = []
        for ws in self.rooms.get(discovery_id, []):
            if ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.rooms[discovery_id].remove(ws)


manager = ConnectionManager()


@router.websocket("/ws/{discovery_id}")
async def discovery_websocket(
    websocket: WebSocket,
    discovery_id: str,
    token: str | None = Query(default=None),
):
    """Real-time collaboration channel for a discovery session.

    Message types:
    - phase_change: {"type": "phase_change", "phase": "orchestrate"}
    - evidence_added: {"type": "evidence_added", "evidence": {...}}
    - cursor: {"type": "cursor", "user": "...", "section": "..."}
    """
    claims = await _validate_ws_token(token)
    if claims is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    # Per-discovery authorization: the authenticated user must own the
    # parent engagement. Refuses cross-tenant room hopping.
    if not await _assert_discovery_access(claims, discovery_id):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if len(manager.rooms.get(discovery_id, [])) >= MAX_CONNECTIONS_PER_ROOM:
        await websocket.close(code=status.WS_1013_TRY_AGAIN_LATER)
        return
    await manager.connect(discovery_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw) > MAX_WS_MESSAGE_BYTES:
                await websocket.send_json({"type": "error", "detail": "Message too large"})
                continue
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue
            if not isinstance(data, dict):
                await websocket.send_json({"type": "error", "detail": "Message must be a JSON object"})
                continue

            msg_type = data.get("type")
            if msg_type not in ALLOWED_INBOUND_MESSAGE_TYPES:
                # Drop silently — a non-whitelisted type would mean a
                # malicious or out-of-date client; don't echo it back.
                logger.debug(
                    "WS rejected message: discovery=%s type=%r",
                    discovery_id,
                    msg_type,
                )
                continue
            logger.debug("WS message: discovery=%s type=%s", discovery_id, msg_type)

            # Relay to all other clients in the same room. Strip any
            # fields that aren't on the allow-list so a poisoned
            # payload can't smuggle extras through the relay.
            sanitized = {
                k: v
                for k, v in data.items()
                if k in {"type", "phase", "evidence", "user", "section"}
            }
            await manager.broadcast(discovery_id, sanitized, exclude=websocket)
    except WebSocketDisconnect:
        manager.disconnect(discovery_id, websocket)
        # Notify remaining users of updated presence
        count = len(manager.rooms.get(discovery_id, []))
        if count > 0:
            await manager.broadcast(
                discovery_id,
                {
                    "type": "presence",
                    "active_users": count,
                },
            )
