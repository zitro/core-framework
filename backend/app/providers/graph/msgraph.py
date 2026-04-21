"""Microsoft Graph provider using app-only client credentials.

App-only Graph requires the app registration to have the Application
permissions (Files.Read.All, Mail.Read, Calendars.Read) consented at the
tenant. With user-delegated access prefer the on-behalf-of flow; this
implementation deliberately stays simple and read-only for v0.5.0.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import httpx
from azure.identity.aio import ClientSecretCredential

from app.config import settings
from app.providers.graph.base import (
    GraphFile,
    GraphMeeting,
    GraphMessage,
    GraphProvider,
)

logger = logging.getLogger(__name__)

_GRAPH = "https://graph.microsoft.com/v1.0"
_SCOPE = "https://graph.microsoft.com/.default"
_TIMEOUT = httpx.Timeout(20.0)


class MsGraphProvider(GraphProvider):
    def __init__(self) -> None:
        self._credential: ClientSecretCredential | None = None
        if (
            settings.azure_tenant_id
            and settings.azure_client_id
            and settings.azure_client_secret
        ):
            self._credential = ClientSecretCredential(
                tenant_id=settings.azure_tenant_id,
                client_id=settings.azure_client_id,
                client_secret=settings.azure_client_secret,
            )

    @property
    def enabled(self) -> bool:
        return self._credential is not None

    async def _token(self) -> str:
        if not self._credential:
            raise RuntimeError("Graph provider not configured")
        token = await self._credential.get_token(_SCOPE)
        return token.token

    async def _get(self, path: str, params: dict | None = None) -> dict:
        token = await self._token()
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{_GRAPH}{path}",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            return r.json()

    async def _search(self, entity: str, query: str, *, limit: int) -> list[dict]:
        token = await self._token()
        body = {
            "requests": [
                {
                    "entityTypes": [entity],
                    "query": {"queryString": query},
                    "from": 0,
                    "size": min(max(limit, 1), 25),
                }
            ]
        }
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(
                f"{_GRAPH}/search/query",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            r.raise_for_status()
            data = r.json()
        hits: list[dict] = []
        for response in data.get("value", []):
            for container in response.get("hitsContainers", []):
                hits.extend(container.get("hits", []))
        return hits

    async def search_files(self, query: str, *, limit: int = 10) -> list[GraphFile]:
        if not self.enabled:
            return []
        try:
            hits = await self._search("driveItem", query, limit=limit)
        except Exception:  # noqa: BLE001
            logger.exception("Graph file search failed")
            return []
        out: list[GraphFile] = []
        for h in hits:
            res = h.get("resource", {})
            out.append(
                GraphFile(
                    id=res.get("id", ""),
                    name=res.get("name", ""),
                    web_url=res.get("webUrl", ""),
                    last_modified=res.get("lastModifiedDateTime", ""),
                    size=int(res.get("size", 0) or 0),
                    snippet=h.get("summary") or "",
                )
            )
        return out

    async def search_messages(self, query: str, *, limit: int = 10) -> list[GraphMessage]:
        if not self.enabled:
            return []
        try:
            hits = await self._search("message", query, limit=limit)
        except Exception:  # noqa: BLE001
            logger.exception("Graph message search failed")
            return []
        out: list[GraphMessage] = []
        for h in hits:
            res = h.get("resource", {})
            sender = (
                res.get("from", {}).get("emailAddress", {}).get("address", "")
                if isinstance(res.get("from"), dict)
                else ""
            )
            out.append(
                GraphMessage(
                    id=res.get("id", ""),
                    subject=res.get("subject", ""),
                    sender=sender,
                    received=res.get("receivedDateTime", ""),
                    web_url=res.get("webLink", ""),
                    snippet=h.get("summary") or "",
                )
            )
        return out

    async def list_meetings(self, *, days: int = 7, limit: int = 20) -> list[GraphMeeting]:
        if not self.enabled:
            return []
        now = datetime.now(UTC)
        end = now + timedelta(days=days)
        try:
            data = await self._get(
                "/users",
                {"$top": 1, "$select": "id"},
            )
            users = data.get("value") or []
            if not users:
                return []
            user_id = users[0]["id"]
            cal = await self._get(
                f"/users/{user_id}/calendarView",
                {
                    "startDateTime": now.isoformat(),
                    "endDateTime": end.isoformat(),
                    "$top": min(max(limit, 1), 50),
                    "$orderby": "start/dateTime",
                },
            )
        except Exception:  # noqa: BLE001
            logger.exception("Graph calendarView failed")
            return []
        out: list[GraphMeeting] = []
        for ev in cal.get("value", []):
            organizer = (
                ev.get("organizer", {})
                .get("emailAddress", {})
                .get("address", "")
            )
            out.append(
                GraphMeeting(
                    id=ev.get("id", ""),
                    subject=ev.get("subject", ""),
                    organizer=organizer,
                    start=ev.get("start", {}).get("dateTime", ""),
                    end=ev.get("end", {}).get("dateTime", ""),
                    join_url=ev.get("onlineMeeting", {}).get("joinUrl", "") or "",
                    snippet=ev.get("bodyPreview", "") or "",
                )
            )
        return out
