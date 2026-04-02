import json
import re
from datetime import date
from typing import Any

from app.services.llm.base import LLMGeneration, LLMGateway, LLMMessage


class MockReviewGateway(LLMGateway):
    async def generate_json(
        self,
        *,
        messages: list[LLMMessage],
        schema_name: str,
        schema: dict[str, Any],
    ) -> LLMGeneration:
        user_message = next((message.content for message in messages if message.role == "user"), "")
        company_name = _extract_field(user_message, "회사명") or "샘플 회사"
        review_date = _extract_field(user_message, "검토일") or date.today().isoformat()

        company_rule_text = _extract_block(user_message, "[회사 취업규칙 원문]", "[표준취업규칙 원문]")
        findings = []

        if "10일" in company_rule_text and ("배우자 출산휴가" in company_rule_text or "출산휴가" in company_rule_text):
            findings.append(
                {
                    "finding_id": "F-001",
                    "clause_title": "배우자 출산휴가 조항",
                    "priority": "critical",
                    "review_type": "legal_update_missing",
                    "related_laws": ["남녀고용평등법 제18조의2"],
                    "current_text": "배우자 출산휴가를 10일로 규정하고 있습니다.",
                    "suggested_text": "관련 법령에 따른 기간과 방식으로 배우자 출산휴가를 부여하도록 수정합니다.",
                    "reason": "배우자 출산휴가 기준이 최신 개정사항을 반영하지 못하고 있습니다.",
                }
            )

        if "임금명세서" not in company_rule_text:
            findings.append(
                {
                    "finding_id": "F-002",
                    "clause_title": "임금명세서 조항 누락",
                    "priority": "important",
                    "review_type": "required_missing",
                    "related_laws": ["근로기준법 제48조"],
                    "current_text": "관련 조항이 확인되지 않습니다.",
                    "suggested_text": "임금 지급 시 임금명세서를 교부한다는 조항을 추가합니다.",
                    "reason": "임금명세서 교부 의무를 취업규칙에 명시할 필요가 있습니다.",
                }
            )

        if "육아휴직" in company_rule_text and ("8세" in company_rule_text or "1년" in company_rule_text):
            findings.append(
                {
                    "finding_id": "F-003",
                    "clause_title": "육아휴직 및 육아기 근로시간 단축",
                    "priority": "urgent",
                    "review_type": "legal_update_missing",
                    "related_laws": ["남녀고용평등법 제19조", "남녀고용평등법 제19조의2"],
                    "current_text": "개정 전 기준으로 육아휴직 또는 자녀 연령을 규정하고 있습니다.",
                    "suggested_text": "관련 법령에 따른 육아휴직 및 육아기 근로시간 단축 기준을 반영합니다.",
                    "reason": "2025년 개정사항 반영 여부를 다시 확인해야 합니다.",
                }
            )

        if not findings:
            findings.append(
                {
                    "finding_id": "F-001",
                    "clause_title": "기본 점검 결과",
                    "priority": "normal",
                    "review_type": "recommendation",
                    "related_laws": ["근로기준법 제93조"],
                    "current_text": "입력 문서에서 명확한 위반 포인트가 자동 식별되지 않았습니다.",
                    "suggested_text": "실제 표준취업규칙 원문과 함께 조문 매핑을 추가 점검합니다.",
                    "reason": "mock 모드는 키워드 기반 점검 결과를 반환합니다.",
                }
            )

        counts = {
            "critical": sum(1 for finding in findings if finding["priority"] == "critical"),
            "urgent": sum(1 for finding in findings if finding["priority"] == "urgent"),
            "important": sum(1 for finding in findings if finding["priority"] == "important"),
            "normal": sum(1 for finding in findings if finding["priority"] == "normal"),
            "reference": sum(1 for finding in findings if finding["priority"] == "reference"),
        }
        payload = {
            "summary": {
                "company_name": company_name,
                "standard_version": "MOEL Standard Employment Rules 2026-02",
                "review_date": review_date,
                "total_findings": len(findings),
                "critical_count": counts["critical"],
                "urgent_count": counts["urgent"],
                "important_count": counts["important"],
                "normal_count": counts["normal"],
                "reference_count": counts["reference"],
                "top_findings": [finding["reason"] for finding in findings[:5]],
            },
            "clause_mappings": [
                {
                    "company_clause": "자동 매핑",
                    "standard_clause": "표준취업규칙 비교 기준",
                    "status": "partial",
                    "notes": "mock 모드에서는 간이 키워드 매핑을 사용합니다.",
                }
            ],
            "required_item_checks": [
                {
                    "item_key": "work_rules_core",
                    "item_label": "기본 취업규칙 점검",
                    "is_present": True,
                    "related_clause": None,
                    "notes": "입력 문서 기반으로 mock 점검을 완료했습니다.",
                }
            ],
            "findings": findings,
            "user_confirmations": [],
            "optional_recommendations": [
                "OPENAI API 키를 연결하면 실제 구조화 진단 결과로 전환할 수 있습니다."
            ],
        }
        raw_text = json.dumps(payload, ensure_ascii=False)
        return LLMGeneration(payload=payload, raw_text=raw_text)


def _extract_field(prompt: str, label: str) -> str | None:
    match = re.search(rf"- {re.escape(label)}: (.+)", prompt)
    return match.group(1).strip() if match else None


def _extract_block(prompt: str, start_marker: str, end_marker: str) -> str:
    pattern = rf"{re.escape(start_marker)}\s*(.*?)\s*{re.escape(end_marker)}"
    match = re.search(pattern, prompt, flags=re.DOTALL)
    return match.group(1).strip() if match else ""
