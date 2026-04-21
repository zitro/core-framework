"""Dataverse Web API provider for Dynamics 365 accounts."""

from __future__ import annotations

import logging
from urllib.parse import quote

import httpx
from azure.identity.aio import ClientSecretCredential

from app.config import settings
from app.providers.dynamics.base import CrmAccount, DynamicsProvider

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(20.0)
_SELECT = "accountid,name,industrycode,revenue,websiteurl,primarycontactid"


def _to_account(row: dict) -> CrmAccount:
    return CrmAccount(
        id=row.get("accountid", ""),
        name=row.get("name", ""),
        industry=str(row.get("industrycode", "") or ""),
        revenue=str(row.get("revenue", "") or ""),
        website=row.get("websiteurl", "") or "",
        primary_contact=str(row.get("_primarycontactid_value", "") or ""),
    )


class DataverseProvider(DynamicsProvider):
    def __init__(self) -> None:
        self._credential: ClientSecretCredential | None = None
        self._base = (settings.dynamics_url or "").rstrip("/")
        if (
            self._base
            and settings.azure_tenant_id
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
        return self._credential is not None and bool(self._base)

    async def _token(self) -> str:
        assert self._credential is not None
        scope = f"{self._base}/.default"
        token = await self._credential.get_token(scope)
        return token.token

    async def _get(self, path: str, params: dict | None = None) -> dict:
        token = await self._token()
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(
                f"{self._base}/api/data/v9.2{path}",
                params=params,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "OData-MaxVersion": "4.0",
                    "OData-Version": "4.0",
                },
            )
            r.raise_for_status()
            return r.json()

    async def search_accounts(self, query: str, *, limit: int = 10) -> list[CrmAccount]:
        if not self.enabled:
            return []
        safe = query.replace("'", "''")
        params = {
            "$select": _SELECT,
            "$filter": f"contains(name,'{safe}')",
            "$top": str(min(max(limit, 1), 50)),
        }
        try:
            data = await self._get("/accounts", params)
        except Exception:  # noqa: BLE001
            logger.exception("Dataverse search_accounts failed")
            return []
        return [_to_account(row) for row in data.get("value", [])]

    async def get_account(self, account_id: str) -> CrmAccount | None:
        if not self.enabled:
            return None
        try:
            data = await self._get(
                f"/accounts({quote(account_id)})",
                {"$select": _SELECT},
            )
        except Exception:  # noqa: BLE001
            logger.exception("Dataverse get_account failed")
            return None
        return _to_account(data)
