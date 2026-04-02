from fastapi import APIRouter, Depends, File, UploadFile

from app.api.dependencies import get_document_ingestion_service
from app.domain.schemas.ingestion import ExtractedDocument
from app.services.ingestion.document_ingestion_service import DocumentIngestionService

router = APIRouter(prefix="/api/v1/ingestion", tags=["ingestion"])


@router.post("/extract-text", response_model=ExtractedDocument)
async def extract_text(
    file: UploadFile = File(...),
    service: DocumentIngestionService = Depends(get_document_ingestion_service),
) -> ExtractedDocument:
    return await service.extract_text(file)
