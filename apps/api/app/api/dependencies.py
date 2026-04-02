from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings
from app.services.ingestion.document_ingestion_service import DocumentIngestionService
from app.services.ingestion.vision_ocr_service import OpenAIVisionOCRService, VisionOCRService
from app.services.llm.base import LLMGateway
from app.services.llm.mock_gateway import MockReviewGateway
from app.services.llm.openai_gateway import OpenAIResponsesGateway
from app.services.review_service import ReviewService


@lru_cache(maxsize=1)
def get_llm_gateway() -> LLMGateway:
    settings = get_settings()
    if settings.llm_mode == "mock":
        return MockReviewGateway()
    if not settings.has_openai_api_key():
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured. Set it in apps/api/.env before live diagnosis.",
        )
    return OpenAIResponsesGateway(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )


@lru_cache(maxsize=1)
def get_ingestion_ocr_service() -> VisionOCRService | None:
    settings = get_settings()
    if settings.ingestion_ocr_provider != "openai":
        return None
    if not settings.has_openai_api_key():
        return None

    return OpenAIVisionOCRService(
        api_key=settings.openai_api_key,
        model=settings.ingestion_ocr_model,
        max_pages=settings.ingestion_ocr_max_pages,
        render_scale=settings.ingestion_ocr_render_scale,
    )


def get_document_ingestion_service() -> DocumentIngestionService:
    return DocumentIngestionService(ocr_service=get_ingestion_ocr_service())


def get_review_service() -> ReviewService:
    settings: Settings = get_settings()
    return ReviewService(
        gateway=get_llm_gateway(),
        max_retries=settings.openai_max_retries,
    )
