from app.providers.dynamics.base import CrmAccount, DynamicsProvider


class NoneDynamicsProvider(DynamicsProvider):
    @property
    def enabled(self) -> bool:
        return False

    async def search_accounts(self, query: str, *, limit: int = 10) -> list[CrmAccount]:
        return []

    async def get_account(self, account_id: str) -> CrmAccount | None:
        return None
