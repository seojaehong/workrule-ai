from app.services.review_payload_repair import repair_review_payload


def test_repair_review_payload_normalizes_review_types_and_counts() -> None:
    payload = {
        "summary": {
            "company_name": "내산",
            "standard_version": "MOEL Standard Employment Rules 2026-02",
            "review_date": "2026-04-02",
            "total_findings": 99,
            "critical_count": 0,
            "urgent_count": 0,
            "important_count": 0,
            "normal_count": 0,
            "reference_count": 0,
            "top_findings": [],
        },
        "findings": [
            {
                "finding_id": "F001",
                "clause_title": "제1조",
                "priority": "critical",
                "review_type": "non_compliant_clauses",
                "related_laws": ["근로기준법 제93조"],
                "current_text": "현행",
                "suggested_text": "개정",
                "reason": "개정 필요",
            },
            {
                "finding_id": "F002",
                "clause_title": "제2조",
                "priority": "important",
                "review_type": "missing_required_clauses",
                "related_laws": [],
                "current_text": "현행",
                "suggested_text": "개정",
                "reason": "추가 필요",
            },
        ],
    }

    repaired = repair_review_payload(payload)

    assert repaired["summary"]["total_findings"] == 2
    assert repaired["summary"]["critical_count"] == 1
    assert repaired["summary"]["important_count"] == 1
    assert repaired["findings"][0]["review_type"] == "violation"
    assert repaired["findings"][1]["review_type"] == "required_missing"


def test_repair_review_payload_normalizes_user_confirmations() -> None:
    payload = {
        "summary": {},
        "findings": [],
        "user_confirmations": [
            {
                "clause_key": "제12조(출장)",
                "content": "출장 규정 확인 필요",
                "required_action": "출장비 규정 반영 여부 확인",
            }
        ],
    }

    repaired = repair_review_payload(payload)

    assert repaired["summary"]["company_name"] == "검토 대상 회사"
    assert repaired["user_confirmations"][0]["item_id"] == "UC-001"
    assert repaired["user_confirmations"][0]["clause_title"] == "제12조(출장)"
    assert repaired["user_confirmations"][0]["question"] == "출장비 규정 반영 여부 확인"
    assert repaired["user_confirmations"][0]["background"] == "출장 규정 확인 필요"
    assert repaired["user_confirmations"][0]["options"] == ["반영", "미반영"]
