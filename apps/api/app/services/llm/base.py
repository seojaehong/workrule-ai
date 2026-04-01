from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class LLMMessage:
    role: str
    content: str


@dataclass(frozen=True)
class LLMGeneration:
    payload: dict[str, Any]
    raw_text: str


class LLMGateway(ABC):
    @abstractmethod
    async def generate_json(
        self,
        *,
        messages: list[LLMMessage],
        schema_name: str,
        schema: dict[str, Any],
    ) -> LLMGeneration:
        raise NotImplementedError

