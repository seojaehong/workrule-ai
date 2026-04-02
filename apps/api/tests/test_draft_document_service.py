from datetime import date

from app.domain.schemas.documents import DraftGenerationRequest
from app.domain.schemas.review import ReviewDiagnosisResult, ReviewFinding, ReviewSummary
from app.services.draft_document_service import DraftDocumentService


def test_generate_draft_replaces_and_inserts_clauses() -> None:
    service = DraftDocumentService()
    request = DraftGenerationRequest(
        company_name="내산",
        baseline_rule_text="취업규칙\n\n제6조(법령과의 관계) 기존 규정.\n\n제8조(성실의무) 기존 문안.",
        diagnosis_result=ReviewDiagnosisResult(
            summary=ReviewSummary(
                company_name="내산",
                standard_version="MOEL Standard Employment Rules 2026-02",
                review_date=date(2026, 4, 2),
                total_findings=2,
                critical_count=0,
                urgent_count=0,
                important_count=0,
                normal_count=2,
                reference_count=0,
                top_findings=[],
            ),
            clause_mappings=[],
            required_item_checks=[],
            findings=[
                ReviewFinding(
                    finding_id="F-001",
                    clause_title="제6조(법령과의 관계)",
                    priority="normal",
                    review_type="recommendation",
                    related_laws=[],
                    current_text="제6조(법령과의 관계) 기존 규정.",
                    suggested_text="제6조(법령과의 관계) 개정 규정.",
                    reason="법령 관계 보완",
                ),
                ReviewFinding(
                    finding_id="F-002",
                    clause_title="조문 2",
                    priority="normal",
                    review_type="recommendation",
                    related_laws=[],
                    current_text="",
                    suggested_text="제7조(차별금지) 차별금지 확장 문안.",
                    reason="누락 조문 추가",
                ),
            ],
            user_confirmations=[],
            optional_recommendations=[],
        ),
    )

    result = service.generate(request)

    assert result.applied_replacements == 1
    assert result.inserted_clauses == 1
    assert result.export_filename.endswith(".hwpx")
    assert "# 내산 최신 취업규칙 초안" in result.draft_markdown
    assert "# 내산 최신 취업규칙 초안" not in result.draft_plain_text
    assert "제6조(법령과의 관계) 개정 규정." in result.draft_markdown
    assert "제7조(차별금지) 차별금지 확장 문안." in result.draft_markdown
