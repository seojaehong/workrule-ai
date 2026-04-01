import json
from typing import Any

from openai import AsyncOpenAI

from app.services.llm.base import LLMGeneration, LLMGateway, LLMMessage


class OpenAIResponsesGateway(LLMGateway):
    def __init__(self, *, api_key: Any, model: str) -> None:
        resolved_api_key = api_key.get_secret_value() if hasattr(api_key, "get_secret_value") else str(api_key)
        self._client = AsyncOpenAI(api_key=resolved_api_key)
        self._model = model

    async def generate_json(
        self,
        *,
        messages: list[LLMMessage],
        schema_name: str,
        schema: dict[str, Any],
    ) -> LLMGeneration:
        response = await self._client.responses.create(
            model=self._model,
            input=[
                {
                    "role": message.role,
                    "content": message.content,
                }
                for message in messages
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
        )

        raw_text = response.output_text
        payload = json.loads(raw_text)
        return LLMGeneration(payload=payload, raw_text=raw_text)

