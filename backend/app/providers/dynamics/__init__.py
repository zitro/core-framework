from functools import lru_cache

from app.config import settings
from app.providers.dynamics.base import DynamicsProvider


@lru_cache(maxsize=1)
def get_dynamics_provider() -> DynamicsProvider:
    match settings.dynamics_provider:
        case "dataverse" | "dynamics":
            from app.providers.dynamics.dataverse import DataverseProvider

            return DataverseProvider()
        case _:
            from app.providers.dynamics.none_provider import NoneDynamicsProvider

            return NoneDynamicsProvider()
