from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.dependencies import get_draft_document_service, get_hwpx_export_service
from app.domain.schemas.documents import DraftGenerationRequest, DraftGenerationResult
from app.services.draft_document_service import DraftDocumentService
from app.services.hwpx_export_service import HWPXExportService

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])


@router.post("/generate-draft", response_model=DraftGenerationResult)
async def generate_draft(
    payload: DraftGenerationRequest,
    service: DraftDocumentService = Depends(get_draft_document_service),
) -> DraftGenerationResult:
    return service.generate(payload)


@router.post("/export-hwpx")
async def export_hwpx(
    payload: DraftGenerationRequest,
    draft_service: DraftDocumentService = Depends(get_draft_document_service),
    export_service: HWPXExportService = Depends(get_hwpx_export_service),
) -> Response:
    draft = draft_service.generate(payload)

    try:
        filename, content = export_service.export(
            filename=draft.export_filename,
            draft_text=draft.draft_plain_text,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": export_service.build_content_disposition(filename),
        },
    )
