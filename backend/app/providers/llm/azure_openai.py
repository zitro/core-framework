import json

from openai import AsyncAzureOpenAI

from app.config import settings
from app.providers.llm.base import LLMProvider


class AzureOpenAIProvider(LLMProvider):
    def __init__(self):
        self.client = AsyncAzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
        )
        self.deployment = settings.azure_openai_deployment

    async def complete(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        response = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=kwargs.get("temperature", 0.7),
            max_tokens=kwargs.get("max_tokens", 2000),
        )
        return response.choices[0].message.content or ""

    async def complete_json(self, system_prompt: str, user_prompt: str, **kwargs) -> dict:
        response = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=kwargs.get("temperature", 0.3),
            max_tokens=kwargs.get("max_tokens", 4000),
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content or "{}")

    async def stream(self, system_prompt: str, user_prompt: str, **kwargs):
        stream = await self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=kwargs.get("temperature", 0.7),
            max_tokens=kwargs.get("max_tokens", 2000),
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
