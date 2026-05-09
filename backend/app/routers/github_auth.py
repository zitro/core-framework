"""GitHub OAuth endpoints for repository source access."""

from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request as FastAPIRequest
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from app.config import settings
from app.dependencies import get_current_user
from app.utils.github_oauth_store import (
    consume_state,
    create_session,
    create_state,
    delete_session,
    get_session,
)

router = APIRouter(dependencies=[Depends(get_current_user)])


def _require_oauth_config() -> None:
    if (
        not settings.github_oauth_client_id.strip()
        or not settings.github_oauth_client_secret.strip()
    ):
        raise HTTPException(
            status_code=503,
            detail="GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET in local environment.",
        )


def _exchange_code_for_token(code: str) -> str:
    payload = urlencode(
        {
            "client_id": settings.github_oauth_client_id,
            "client_secret": settings.github_oauth_client_secret,
            "code": code,
            "redirect_uri": settings.github_oauth_redirect_uri,
        }
    ).encode("utf-8")
    req = Request(
        "https://github.com/login/oauth/access_token",
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "core-discovery-api",
        },
        method="POST",
    )
    with urlopen(req, timeout=20) as resp:  # noqa: S310
        body = json.loads(resp.read().decode("utf-8"))
    token = str(body.get("access_token") or "").strip()
    if not token:
        message = str(body.get("error_description") or body.get("error") or "Token exchange failed")
        raise HTTPException(status_code=400, detail=message)
    return token


def _fetch_login(access_token: str) -> str:
    req = Request(
        "https://api.github.com/user",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "core-discovery-api",
        },
    )
    with urlopen(req, timeout=20) as resp:  # noqa: S310
        body = json.loads(resp.read().decode("utf-8"))
    return str(body.get("login") or "github-user")


@router.get("/oauth/start")
async def oauth_start() -> RedirectResponse:
    _require_oauth_config()
    state = create_state()
    url = "https://github.com/login/oauth/authorize?" + urlencode(
        {
            "client_id": settings.github_oauth_client_id,
            "redirect_uri": settings.github_oauth_redirect_uri,
            "scope": settings.github_oauth_scope,
            "state": state,
        }
    )
    return RedirectResponse(url=url, status_code=302)


@router.get("/oauth/callback")
async def oauth_callback(
    request: FastAPIRequest,
    code: str = "",
    state: str = "",
    error: str = "",
) -> HTMLResponse:
    if error:
        return HTMLResponse(
            content=f"""
            <html><body>
            <script>
              if (window.opener) {{
                window.opener.postMessage({{ type: "github-oauth", success: false, error: {json.dumps(error)} }}, "*");
              }}
              window.close();
            </script>
            </body></html>
            """,
            status_code=400,
        )

    _require_oauth_config()
    if not code.strip() or not state.strip() or not consume_state(state):
        raise HTTPException(status_code=400, detail="Invalid OAuth callback state")

    token = _exchange_code_for_token(code)
    login = _fetch_login(token)
    sid = create_session(token, login, settings.github_oauth_session_ttl_seconds)

    response = HTMLResponse(
        content="""
        <html><body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: "github-oauth", success: true }, "*");
          }
          window.close();
        </script>
        </body></html>
        """,
        status_code=200,
    )
    is_secure = request.url.scheme == "https"
    response.set_cookie(
        key=settings.github_oauth_cookie_name,
        value=sid,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.github_oauth_session_ttl_seconds,
        path="/",
    )
    return response


@router.get("/oauth/status")
async def oauth_status(request: FastAPIRequest) -> dict:
    sid = request.cookies.get(settings.github_oauth_cookie_name)
    session = get_session(sid)
    if not session:
        return {"connected": False, "login": ""}
    _, login = session
    return {"connected": True, "login": login}


@router.post("/oauth/disconnect")
async def oauth_disconnect(request: FastAPIRequest) -> JSONResponse:
    sid = request.cookies.get(settings.github_oauth_cookie_name)
    delete_session(sid)
    response = JSONResponse({"disconnected": True})
    response.delete_cookie(key=settings.github_oauth_cookie_name, path="/")
    return response
