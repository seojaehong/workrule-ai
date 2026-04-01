from functools import lru_cache

from app.core.config import Settings, get_settings
from app.services.llm.base import LLMGateway
from app.services.llm.openai_gateway import OpenAIResponsesGateway
from app.services.review_service import ReviewService


@lru_cache(maxsize=1)
def get_llm_gateway() -> LLMGateway:
    settings = get_settings()
    return OpenAIResponsesGateway(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )


def get_review_service() -> ReviewService:
    settings: Settings = get_settings()
    return ReviewService(
        gateway=get_llm_gateway(),
        max_retries=settings.openai_max_retries,
    )

