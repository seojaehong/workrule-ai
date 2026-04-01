from typing import Any

import pytest

from app.domain.schemas.review import ReviewDiagnosisResult
from app.services.llm.base import LLMGeneration, LLMGateway, LLMMessage
from app.services.output_validation_harness import OutputValidationError, OutputValidationHarness


class SequenceGateway(LLMGateway):
    def __init__(self, payloads: list[dict[str, Any]]) -> None:
        self._payloads = payloads
        self.calls: list[list[LLMMessage]] = []

    async def generate_json(
        self,
        *,
        messages: list[LLMMessage],
        schema_name: str,
        schema: dict[str, Any],
    ) -> LLMGeneration:
        self.calls.append(messages)
        payload = self._payloads.pop(0)
        return LLMGeneration(payload=payload, raw_text=str(payload))


@pytest.mark.asyncio
async def test_validation_harness_retries_until_payload_is_valid() -> None:
    invalid_payload = {
        "summary": {
            "company_name": "테스트 회사",
            "standard_version": "MOEL Standard Employment Rules 2026-02",
            "review_date": "2026-04-01",
            "total_findings": 1,
            "critical_count": 1,
            "urgent_count": 0,
            "important_count": 0,
            "normal_count": 0,
            "reference_count": 0,
        },
        "clause_mappings": [],
        "required_item_checks": [],
        "findings": [
            {
                "finding_id": "F-001",
                "clause_title": "제1조(목적)",
                "priority": "critical",
                "review_type": "violation",
                "related_laws": ["근로기준법 제93조"],
                "current_text": "목적 조항",
                "reason": "suggested_text가 빠져서 실패해야 한다.",
            }
        ],
        "user_confirmations": [],
        "optional_recommendations": [],
    }
    valid_payload = {
        "summary": {
            "company_name": "테스트 회사",
            "standard_version": "MOEL Standard Employment Rules 2026-02",
            "review_date": "2026-04-01",
            "total_findings": 1,
            "critical_count": 1,
            "urgent_count": 0,
            "important_count": 0,
            "normal_count": 0,
            "reference_count": 0,
            "top_findings": ["육아휴직 조항 개정 필요"],
        },
        "clause_mappings": [],
        "required_item_checks": [],
        "findings": [
            {
                "finding_id": "F-001",
                "clause_title": "제1조(목적)",
                "priority": "critical",
                "review_type": "violation",
                "related_laws": ["근로기준법 제93조"],
                "current_text": "기존 목적 조항",
                "suggested_text": "개정 목적 조항",
                "reason": "강행규정 반영이 필요하다.",
            }
        ],
        "user_confirmations": [],
        "optional_recommendations": [],
    }
    gateway = SequenceGateway([invalid_payload, valid_payload])
    harness = OutputValidationHarness(
        gateway=gateway,
        response_model=ReviewDiagnosisResult,
        schema_name="employment_rules_review_result",
        max_retries=2,
    )

    result = await harness.run([LLMMessage(role="user", content="테스트")])

    assert result.summary.company_name == "테스트 회사"
    assert len(gateway.calls) == 2


@pytest.mark.asyncio
async def test_validation_harness_raises_after_exhausting_retries() -> None:
    invalid_payload = {
        "summary": {
            "company_name": "테스트 회사",
            "standard_version": "MOEL Standard Employment Rules 2026-02",
            "review_date": "2026-04-01",
            "total_findings": 1,
            "critical_count": 1,
            "urgent_count": 0,
            "important_count": 0,
            "normal_count": 0,
            "reference_count": 0,
        }
    }
    gateway = SequenceGateway([invalid_payload, invalid_payload])
    harness = OutputValidationHarness(
        gateway=gateway,
        response_model=ReviewDiagnosisResult,
        schema_name="employment_rules_review_result",
        max_retries=2,
    )

    with pytest.raises(OutputValidationError) as exc_info:
        await harness.run([LLMMessage(role="user", content="테스트")])

    assert exc_info.value.attempts == 2

