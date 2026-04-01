from fastapi import APIRouter, Depends

from app.api.dependencies import get_review_service
from app.domain.schemas.review import ReviewDiagnosisRequest, ReviewDiagnosisResult
from app.services.review_service import ReviewService

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


@router.post("/diagnose", response_model=ReviewDiagnosisResult)
async def diagnose_rules(
    payload: ReviewDiagnosisRequest,
    service: ReviewService = Depends(get_review_service),
) -> ReviewDiagnosisResult:
    return await service.diagnose(payload)

