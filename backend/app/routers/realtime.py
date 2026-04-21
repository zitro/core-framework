"""WebSocket hub for real-time collaboration on discoveries."""

import json
import logging
from collections import defaultdict

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.providers.auth import get_auth_provider

logger = logging.getLogger(__name__)

router = APIRouter()


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
    - phase_change: {"type": "phase_change", "phase": "orient"}
    - evidence_added: {"type": "evidence_added", "evidence": {...}}
    - cursor: {"type": "cursor", "user": "...", "section": "..."}
    """
    claims = await _validate_ws_token(token)
    if claims is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await manager.connect(discovery_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue

            msg_type = data.get("type", "unknown")
            logger.debug("WS message: discovery=%s type=%s", discovery_id, msg_type)

            # Relay to all other clients in the same room
            await manager.broadcast(discovery_id, data, exclude=websocket)
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
