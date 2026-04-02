import json
import logging
from typing import Callable, Generic, TypeVar

from pydantic import BaseModel, ValidationError

from app.services.llm.base import LLMGateway, LLMMessage

logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT", bound=BaseModel)


class OutputValidationError(RuntimeError):
    def __init__(self, message: str, *, attempts: int, last_error: str, last_raw_text: str) -> None:
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error
        self.last_raw_text = last_raw_text


class OutputValidationHarness(Generic[ModelT]):
    def __init__(
        self,
        *,
        gateway: LLMGateway,
        response_model: type[ModelT],
        schema_name: str,
        max_retries: int = 3,
        payload_repair: Callable[[dict[str, object]], dict[str, object]] | None = None,
    ) -> None:
        self._gateway = gateway
        self._response_model = response_model
        self._schema_name = schema_name
        self._max_retries = max_retries
        self._payload_repair = payload_repair

    async def run(self, messages: list[LLMMessage]) -> ModelT:
        attempt_messages = list(messages)
        last_error = ""
        last_raw_text = ""

        for attempt in range(1, self._max_retries + 1):
            generation = await self._gateway.generate_json(
                messages=attempt_messages,
                schema_name=self._schema_name,
                schema=self._response_model.model_json_schema(),
            )
            last_raw_text = generation.raw_text

            try:
                payload = generation.payload
                if self._payload_repair is not None:
                    payload = self._payload_repair(payload)
                return self._response_model.model_validate(payload)
            except ValidationError as exc:
                last_error = exc.json()
                logger.warning("LLM output validation failed on attempt %s: %s", attempt, last_error)

                if attempt == self._max_retries:
                    break

                repair_instruction = self._build_repair_instruction(
                    raw_text=generation.raw_text,
                    error_json=last_error,
                )
                attempt_messages.extend(
                    [
                        LLMMessage(role="assistant", content=generation.raw_text),
                        LLMMessage(role="user", content=repair_instruction),
                    ]
                )

        raise OutputValidationError(
            "LLM output did not pass schema validation.",
            attempts=self._max_retries,
            last_error=last_error,
            last_raw_text=last_raw_text,
        )

    def _build_repair_instruction(self, *, raw_text: str, error_json: str) -> str:
        pretty_raw = raw_text
        try:
            pretty_raw = json.dumps(json.loads(raw_text), ensure_ascii=False, indent=2)
        except json.JSONDecodeError:
            logger.warning("Received non-JSON text during repair path.")

        return f"""
이전 응답은 스키마 검증에 실패했다.
반드시 JSON만 다시 생성하고, 누락되거나 잘못된 필드를 수정하라.

[이전 응답]
{pretty_raw}

[검증 오류]
{error_json}
""".strip()
