from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings
from app.services.draft_document_service import DraftDocumentService
from app.services.hwpx_export_service import HWPXExportService
from app.services.ingestion.document_ingestion_service import DocumentIngestionService
from app.services.ingestion.ocr_service import OCRService, OpenAIVisionOCRService, UpstageDocumentParseService
from app.services.llm.base import LLMGateway
from app.services.llm.mock_gateway import MockReviewGateway
from app.services.llm.openai_gateway import OpenAIResponsesGateway
from app.services.llm.upstage_gateway import UpstageChatCompletionsGateway
from app.services.review_service import ReviewService


@lru_cache(maxsize=1)
def get_llm_gateway() -> LLMGateway:
    settings = get_settings()
    if settings.llm_mode == "mock":
        return MockReviewGateway()
    if settings.llm_mode == "upstage":
        if not settings.has_upstage_api_key():
            raise HTTPException(
                status_code=503,
                detail="UPSTAGE_API_KEY is not configured. Set it in apps/api/.env before live diagnosis.",
            )
        return UpstageChatCompletionsGateway(
            api_key=settings.upstage_api_key,
            model=settings.upstage_model,
        )
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
def get_ingestion_ocr_service() -> OCRService | None:
    settings = get_settings()
    if settings.ingestion_ocr_provider == "openai":
        if not settings.has_openai_api_key():
            return None
        return OpenAIVisionOCRService(
            api_key=settings.openai_api_key,
            model=settings.ingestion_ocr_model,
            max_pages=settings.ingestion_ocr_max_pages,
            render_scale=settings.ingestion_ocr_render_scale,
        )

    if settings.ingestion_ocr_provider == "upstage":
        if not settings.has_upstage_api_key():
            return None
        return UpstageDocumentParseService(
            api_key=settings.upstage_api_key,
            timeout_seconds=settings.ingestion_ocr_timeout_seconds,
            output_format=settings.ingestion_ocr_output_format,
        )

    return None


def get_document_ingestion_service() -> DocumentIngestionService:
    return DocumentIngestionService(ocr_service=get_ingestion_ocr_service())


def get_review_service() -> ReviewService:
    settings: Settings = get_settings()
    return ReviewService(
        gateway=get_llm_gateway(),
        max_retries=settings.openai_max_retries,
    )


def get_draft_document_service() -> DraftDocumentService:
    return DraftDocumentService()


def get_hwpx_export_service() -> HWPXExportService:
    settings = get_settings()
    if not settings.hwpx_template_path:
        raise HTTPException(
            status_code=503,
            detail="HWPX_TEMPLATE_PATH is not configured. Set it in apps/api/.env before exporting.",
        )
    return HWPXExportService(template_path=settings.hwpx_template_path)
