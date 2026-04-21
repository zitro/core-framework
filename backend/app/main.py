import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings

logger = logging.getLogger("core")


def _configure_logging() -> None:
    """Set up structured logging with consistent format."""
    log_level = logging.DEBUG if settings.debug else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])


def create_app() -> FastAPI:
    _configure_logging()

    # Validate environment on startup
    warnings = settings.validate_providers()
    for w in warnings:
        logger.warning("Config: %s", w)

    from app.routers import (
        advisor,
        agents,
        blueprints,
        discovery,
        docs,
        dt_templates,
        dynamics,
        engagement,
        engagements,
        evidence,
        export,
        graph,
        grounding,
        me,
        narrative,
        problem_statements,
        questions,
        realtime,
        reviews,
        search,
        transcripts,
    )

    app = FastAPI(
        title=settings.app_name,
        version="0.5.0",
        description="CORE Discovery Framework API",
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception("%s %s 500 %.1fms", request.method, request.url.path, duration_ms)
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s %d %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response

    app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])
    app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
    app.include_router(transcripts.router, prefix="/api/transcripts", tags=["transcripts"])
    app.include_router(evidence.router, prefix="/api/evidence", tags=["evidence"])
    app.include_router(
        problem_statements.router,
        prefix="/api/problem-statements",
        tags=["problem-statements"],
    )
    app.include_router(export.router, prefix="/api/export", tags=["export"])
    app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
    app.include_router(
        advisor.router,
        prefix="/api/advisor",
        tags=["advisor"],
    )
    app.include_router(
        blueprints.router,
        prefix="/api/blueprints",
        tags=["blueprints"],
    )
    app.include_router(realtime.router, tags=["realtime"])
    app.include_router(engagement.router, prefix="/api/engagement", tags=["engagement"])
    app.include_router(search.router, prefix="/api", tags=["search"])
    app.include_router(narrative.router, prefix="/api/narrative", tags=["narrative"])
    app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
    app.include_router(dt_templates.router, prefix="/api/dt-templates", tags=["dt-templates"])
    app.include_router(me.router, prefix="/api/me", tags=["me"])
    app.include_router(engagements.router, prefix="/api/engagements", tags=["engagements"])
    app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
    app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
    app.include_router(dynamics.router, prefix="/api/dynamics", tags=["dynamics"])
    app.include_router(grounding.router, prefix="/api/grounding", tags=["grounding"])

    @app.on_event("startup")
    async def _ensure_storage() -> None:
        from app.providers.storage import KNOWN_COLLECTIONS, get_storage_provider

        try:
            provider = get_storage_provider()
            await provider.ensure_collections(KNOWN_COLLECTIONS)
            logger.info("Storage ready (%d collections)", len(KNOWN_COLLECTIONS))
        except Exception:  # noqa: BLE001
            logger.exception("Storage ensure_collections failed")

    @app.get("/api/health")
    async def health():
        return {
            "status": "healthy",
            "providers": {
                "llm": settings.llm_provider,
                "storage": settings.storage_provider,
                "speech": settings.speech_provider,
                "auth": settings.auth_provider,
                "search": settings.search_provider,
                "graph": settings.graph_provider,
                "dynamics": settings.dynamics_provider,
            },
        }

    logger.info(
        "CORE Discovery API started — llm=%s storage=%s auth=%s",
        settings.llm_provider,
        settings.storage_provider,
        settings.auth_provider,
    )

    return app


app = create_app()
