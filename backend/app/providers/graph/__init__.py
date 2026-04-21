from functools import lru_cache

from app.config import settings
from app.providers.graph.base import GraphProvider


@lru_cache(maxsize=1)
def get_graph_provider() -> GraphProvider:
    match settings.graph_provider:
        case "msgraph" | "azure":
            from app.providers.graph.msgraph import MsGraphProvider

            return MsGraphProvider()
        case _:
            from app.providers.graph.none_provider import NoneGraphProvider

            return NoneGraphProvider()
