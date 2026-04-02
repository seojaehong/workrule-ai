import json
from typing import Any

from openai import AsyncOpenAI

from app.services.llm.base import LLMGeneration, LLMGateway, LLMMessage


class UpstageChatCompletionsGateway(LLMGateway):
    def __init__(self, *, api_key: Any, model: str) -> None:
        resolved_api_key = api_key.get_secret_value() if hasattr(api_key, "get_secret_value") else str(api_key)
        self._client = AsyncOpenAI(
            api_key=resolved_api_key,
            base_url="https://api.upstage.ai/v1",
        )
        self._model = model

    async def generate_json(
        self,
        *,
        messages: list[LLMMessage],
        schema_name: str,
        schema: dict[str, Any],
    ) -> LLMGeneration:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {
                    "role": message.role,
                    "content": message.content,
                }
                for message in messages
            ],
            temperature=0,
        )
        raw_text = response.choices[0].message.content or ""
        normalized_text = _strip_json_fence(raw_text)
        payload = json.loads(normalized_text)
        return LLMGeneration(payload=payload, raw_text=normalized_text)


def _strip_json_fence(raw_text: str) -> str:
    trimmed = raw_text.strip()
    if trimmed.startswith("```json"):
        trimmed = trimmed[len("```json") :].strip()
    elif trimmed.startswith("```"):
        trimmed = trimmed[len("```") :].strip()

    if trimmed.endswith("```"):
        trimmed = trimmed[:-3].strip()

    return trimmed
