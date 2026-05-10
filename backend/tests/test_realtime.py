"""Tests for WebSocket real-time collaboration."""

from starlette.testclient import TestClient


def test_websocket_connect_and_message():
    """Test WebSocket connection and message relay using sync test client."""
    import os

    os.environ["LLM_PROVIDER"] = "local"
    os.environ["STORAGE_PROVIDER"] = "local"
    os.environ["AUTH_PROVIDER"] = "none"
    os.environ["LOCAL_STORAGE_PATH"] = "./test_data"

    from app.providers.auth import get_auth_provider
    from app.providers.llm import get_llm_provider
    from app.providers.storage import get_storage_provider

    get_auth_provider.cache_clear()
    get_llm_provider.cache_clear()
    get_storage_provider.cache_clear()

    from app.main import create_app

    app = create_app()
    client = TestClient(app)

    # Create a discovery first — WS handler now enforces per-discovery
    # access via the parent engagement's owners list.
    res = client.post("/api/discovery/", json={"name": "WS Test"})
    assert res.status_code in (200, 201), res.text
    discovery_id = res.json()["id"]

    ws_path = f"/ws/{discovery_id}"
    with client.websocket_connect(ws_path) as ws1:
        with client.websocket_connect(ws_path) as ws2:
            # Both should receive presence update
            msg1 = ws2.receive_json()
            assert msg1["type"] == "presence"
            assert msg1["active_users"] == 2

            # ws1 sends an allowed message, ws2 should receive it
            ws1.send_json({"type": "phase_change", "phase": "orchestrate"})
            msg2 = ws2.receive_json()
            assert msg2["type"] == "phase_change"
            assert msg2["phase"] == "orchestrate"

            # An out-of-allowlist type should be dropped, not relayed.
            ws1.send_json({"type": "evil_spoof", "user": "attacker"})
            # ws2 should not receive anything; verify by sending a
            # legitimate follow-up and confirming that's what arrives.
            ws1.send_json({"type": "cursor", "user": "u1", "section": "intro"})
            msg3 = ws2.receive_json()
            assert msg3["type"] == "cursor"
