"""Shared test fixtures for the CORE Discovery API."""

import os
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# Force local/none providers before importing app
os.environ["LLM_PROVIDER"] = "local"
os.environ["STORAGE_PROVIDER"] = "local"
os.environ["AUTH_PROVIDER"] = "none"
os.environ["SPEECH_PROVIDER"] = "none"
os.environ["LOCAL_STORAGE_PATH"] = "./test_data"


@pytest.fixture(autouse=True)
def _clean_test_data():
    """Create and clean up test data directory for each test."""
    import shutil
    from pathlib import Path

    test_dir = Path("./test_data")
    test_dir.mkdir(parents=True, exist_ok=True)
    yield
    if test_dir.exists():
        shutil.rmtree(test_dir)


@pytest.fixture()
def app() -> FastAPI:
    """Create a fresh app instance for testing."""
    # Clear cached providers so each test gets fresh state
    from app.providers.auth import get_auth_provider
    from app.providers.llm import get_llm_provider
    from app.providers.storage import get_storage_provider

    get_auth_provider.cache_clear()
    get_llm_provider.cache_clear()
    get_storage_provider.cache_clear()

    from app.main import create_app

    return create_app()


@pytest.fixture()
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient]:
    """Async HTTP client wired to the test app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture()
def mock_llm() -> AsyncMock:
    """A mock LLM provider that returns controlled JSON responses."""
    mock = AsyncMock()
    mock.complete_json.return_value = {
        "questions": [
            {
                "text": "What is the current workflow?",
                "purpose": "Understand baseline",
                "follow_ups": ["How long has this been in place?"],
            }
        ]
    }
    return mock
