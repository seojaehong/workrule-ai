from datetime import date

from app.domain.schemas.review import ReviewDiagnosisRequest, ReviewDiagnosisResult
from app.services.llm.base import LLMGateway
from app.services.output_validation_harness import OutputValidationHarness
from app.services.prompt_harness import STANDARD_VERSION, build_review_messages


class ReviewService:
    def __init__(self, *, gateway: LLMGateway, max_retries: int = 3) -> None:
        self._harness = OutputValidationHarness(
            gateway=gateway,
            response_model=ReviewDiagnosisResult,
            schema_name="employment_rules_review_result",
            max_retries=max_retries,
        )

    async def diagnose(self, request: ReviewDiagnosisRequest) -> ReviewDiagnosisResult:
        request_with_defaults = request.model_copy(
            update={
                "review_date": request.review_date or date.today(),
            }
        )
        messages = build_review_messages(request_with_defaults)
        result = await self._harness.run(messages)

        if result.summary.standard_version != STANDARD_VERSION:
            result.summary.standard_version = STANDARD_VERSION

        if result.summary.company_name != request.company_name:
            result.summary.company_name = request.company_name

        return result

