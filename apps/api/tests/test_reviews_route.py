from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_review_service
from app.api.routes.reviews import router
from app.domain.schemas.review import ReviewDiagnosisRequest, ReviewDiagnosisResult, ReviewSummary
from app.services.review_service import ReviewService


class StubReviewService(ReviewService):
    def __init__(self) -> None:
        pass

    async def diagnose(self, request: ReviewDiagnosisRequest) -> ReviewDiagnosisResult:
        return ReviewDiagnosisResult(
            summary=ReviewSummary(
                company_name=request.company_name,
                standard_version="MOEL Standard Employment Rules 2026-02",
                review_date=request.review_date or date(2026, 4, 1),
                total_findings=0,
                critical_count=0,
                urgent_count=0,
                important_count=0,
                normal_count=0,
                reference_count=0,
                top_findings=[],
            ),
            clause_mappings=[],
            required_item_checks=[],
            findings=[],
            user_confirmations=[],
            optional_recommendations=[],
        )


def test_reviews_route_returns_structured_payload() -> None:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_review_service] = lambda: StubReviewService()

    client = TestClient(app)

    response = client.post(
        "/api/v1/reviews/diagnose",
        json={
            "company_name": "테스트 회사",
            "company_rule_text": "제1조 목적",
            "standard_rule_text": "표준 제1조 목적",
            "focus_areas": ["휴가"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["company_name"] == "테스트 회사"
