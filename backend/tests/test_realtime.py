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

    with client.websocket_connect("/ws/test-discovery") as ws1:
        with client.websocket_connect("/ws/test-discovery") as ws2:
            # Both should receive presence update
            msg1 = ws2.receive_json()
            assert msg1["type"] == "presence"
            assert msg1["active_users"] == 2

            # ws1 sends a message, ws2 should receive it
            ws1.send_json({"type": "phase_change", "phase": "orient"})
            msg2 = ws2.receive_json()
            assert msg2["type"] == "phase_change"
            assert msg2["phase"] == "orient"
