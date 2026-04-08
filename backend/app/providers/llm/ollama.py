import json

import httpx

from app.config import settings
from app.providers.llm.base import LLMProvider


class OllamaProvider(LLMProvider):
    """Local Ollama LLM provider for offline/local development."""

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model

    async def complete(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": False,
                    "options": {"temperature": kwargs.get("temperature", 0.7)},
                },
            )
            response.raise_for_status()
            return response.json()["message"]["content"]

    async def complete_json(self, system_prompt: str, user_prompt: str, **kwargs) -> dict:
        enhanced_prompt = (
            f"{system_prompt}\n\nYou MUST respond with valid JSON only. No markdown, no explanation."
        )
        result = await self.complete(enhanced_prompt, user_prompt, **kwargs)
        # Strip markdown fences if present
        if result.startswith("```"):
            result = result.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(result)

    async def stream(self, system_prompt: str, user_prompt: str, **kwargs):
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": True,
                    "options": {"temperature": kwargs.get("temperature", 0.7)},
                },
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if not data.get("done") and "message" in data:
                            yield data["message"]["content"]
