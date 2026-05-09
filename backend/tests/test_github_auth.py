import pytest

from app.config import settings
from app.utils.github_oauth_store import create_session, delete_session


@pytest.mark.asyncio
async def test_github_oauth_status_disconnected(client):
    resp = await client.get("/api/github/oauth/status")
    assert resp.status_code == 200
    assert resp.json() == {"connected": False, "login": ""}


@pytest.mark.asyncio
async def test_github_oauth_status_connected_from_cookie(client):
    sid = create_session("token-1", "octocat", ttl_seconds=120)
    try:
        resp = await client.get(
            "/api/github/oauth/status",
            cookies={settings.github_oauth_cookie_name: sid},
        )
        assert resp.status_code == 200
        assert resp.json() == {"connected": True, "login": "octocat"}
    finally:
        delete_session(sid)


@pytest.mark.asyncio
async def test_github_oauth_start_requires_config(client):
    original_id = settings.github_oauth_client_id
    original_secret = settings.github_oauth_client_secret
    try:
        settings.github_oauth_client_id = ""
        settings.github_oauth_client_secret = ""
        resp = await client.get("/api/github/oauth/start")
        assert resp.status_code == 503
    finally:
        settings.github_oauth_client_id = original_id
        settings.github_oauth_client_secret = original_secret


@pytest.mark.asyncio
async def test_github_oauth_disconnect_clears_cookie(client):
    sid = create_session("token-2", "octocat", ttl_seconds=120)
    resp = await client.post(
        "/api/github/oauth/disconnect",
        cookies={settings.github_oauth_cookie_name: sid},
    )
    assert resp.status_code == 200
    assert resp.json() == {"disconnected": True}
    assert settings.github_oauth_cookie_name in resp.headers.get("set-cookie", "")
