from app.services.review_preprocessor import ReviewPreprocessor


def test_review_preprocessor_builds_clause_candidates() -> None:
    processor = ReviewPreprocessor()
    company_text = """
제1조(목적) 회사 규칙의 목적을 정한다.
제2조(휴가) 연차휴가를 10일 부여한다.
제4조(복무) 성실의무를 정한다.
""".strip()
    standard_text = """
제1조(목적) 회사 규칙의 목적을 정한다.
제2조(휴가) 연차휴가는 법정 기준에 따른다.
제3조(임금명세서) 임금명세서를 교부한다.
""".strip()

    result = processor.build(company_rule_text=company_text, standard_rule_text=standard_text)

    assert result.company_clause_count == 3
    assert result.standard_clause_count == 3
    statuses = {candidate.article_key: candidate.status for candidate in result.clause_candidates}
    assert statuses["제1조"] == "matched"
    assert statuses["제2조"] == "partial"
    assert statuses["제3조"] == "missing"
    assert statuses["제4조"] == "custom"
