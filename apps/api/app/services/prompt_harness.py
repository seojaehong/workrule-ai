from app.domain.schemas.review import ReviewDiagnosisRequest
from app.services.llm.base import LLMMessage


STANDARD_VERSION = "MOEL Standard Employment Rules 2026-02"


def build_review_messages(request: ReviewDiagnosisRequest) -> list[LLMMessage]:
    focus_areas = ", ".join(request.focus_areas) if request.focus_areas else "없음"
    industry = request.industry or "미확인"
    employee_count = str(request.employee_count) if request.employee_count else "미확인"
    review_date = request.review_date.isoformat() if request.review_date else "2026-04-01"

    system_prompt = f"""
당신은 취업규칙 법령 검토 엔진이다.
반드시 JSON만 반환해야 하며, 설명문이나 마크다운을 섞지 않는다.
검토 기준은 {STANDARD_VERSION}이다.
판단이 불확실한 항목은 user_confirmations로 분리한다.
모든 findings에는 current_text, suggested_text, reason을 반드시 채운다.
""".strip()

    user_prompt = f"""
[검토 컨텍스트]
- 회사명: {request.company_name}
- 업종: {industry}
- 상시근로자 수: {employee_count}
- 중점 검토 영역: {focus_areas}
- 검토일: {review_date}

[작업 지시]
1. 회사 취업규칙과 표준취업규칙을 비교해 조문 매핑을 생성한다.
2. 필수기재사항 반영 여부를 점검한다.
3. 법령 위반, 필수기재사항 누락, 법령개정 미반영, 표현 부정확, 개선 권고를 findings로 정리한다.
4. 사업장 특성이나 선택 조항처럼 사용자 확인이 필요한 항목은 user_confirmations에 넣는다.
5. summary.count 값은 findings를 기준으로 일관되게 계산한다.

[회사 취업규칙 원문]
{request.company_rule_text}

[표준취업규칙 원문]
{request.standard_rule_text}
""".strip()

    return [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=user_prompt),
    ]

