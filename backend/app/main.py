from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import discovery, questions, transcripts, evidence


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="CORE Discovery Framework API",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])
    app.include_router(questions.router, prefix="/api/questions", tags=["questions"])
    app.include_router(transcripts.router, prefix="/api/transcripts", tags=["transcripts"])
    app.include_router(evidence.router, prefix="/api/evidence", tags=["evidence"])

    @app.get("/api/health")
    async def health():
        return {
            "status": "healthy",
            "providers": {
                "llm": settings.llm_provider,
                "storage": settings.storage_provider,
                "auth": settings.auth_provider,
            },
        }

    return app


app = create_app()
