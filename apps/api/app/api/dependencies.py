from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings
from app.services.llm.base import LLMGateway
from app.services.llm.mock_gateway import MockReviewGateway
from app.services.llm.openai_gateway import OpenAIResponsesGateway
from app.services.review_service import ReviewService


@lru_cache(maxsize=1)
def get_llm_gateway() -> LLMGateway:
    settings = get_settings()
    if settings.llm_mode == "mock":
        return MockReviewGateway()
    if settings.openai_api_key is None:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured. Set it in apps/api/.env before live diagnosis.",
        )
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
