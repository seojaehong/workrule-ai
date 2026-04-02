import pytest

from app.domain.schemas.review import ReviewDiagnosisResult
from app.services.llm.base import LLMMessage
from app.services.llm.mock_gateway import MockReviewGateway


@pytest.mark.asyncio
async def test_mock_gateway_returns_schema_compatible_payload() -> None:
    gateway = MockReviewGateway()

    generation = await gateway.generate_json(
        messages=[
            LLMMessage(role="system", content="test"),
            LLMMessage(
                role="user",
                content="""
- 회사명: 스모크테스트 주식회사
- 검토일: 2026-04-02

[회사 취업규칙 원문]
제21조(배우자 출산휴가)
회사는 배우자 출산 시 10일의 휴가를 부여한다.

[표준취업규칙 원문]
제23조(배우자 출산휴가)
회사는 관련 법령에 따라 배우자 출산휴가를 부여한다.
""".strip(),
            ),
        ],
        schema_name="employment_rules_review_result",
        schema=ReviewDiagnosisResult.model_json_schema(),
    )

    result = ReviewDiagnosisResult.model_validate(generation.payload)

    assert result.summary.company_name == "스모크테스트 주식회사"
    assert result.summary.total_findings >= 1
