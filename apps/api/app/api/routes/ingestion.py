from fastapi import APIRouter, File, UploadFile

from app.domain.schemas.ingestion import ExtractedDocument
from app.services.ingestion.document_ingestion_service import DocumentIngestionService

router = APIRouter(prefix="/api/v1/ingestion", tags=["ingestion"])
service = DocumentIngestionService()


@router.post("/extract-text", response_model=ExtractedDocument)
async def extract_text(file: UploadFile = File(...)) -> ExtractedDocument:
    return await service.extract_text(file)
