from copy import deepcopy
from datetime import date
from typing import Any


_REVIEW_TYPE_ALIASES = {
    "non_compliant_clauses": "violation",
    "missing_required_clauses": "required_missing",
    "expression_issues": "wording_issue",
    "recommendations": "recommendation",
    "reference_count": "recommendation",
}

_PRIORITY_VALUES = {"critical", "urgent", "important", "normal", "reference"}
_REVIEW_TYPE_VALUES = {
    "violation",
    "required_missing",
    "legal_update_missing",
    "wording_issue",
    "recommendation",
}


def repair_review_payload(payload: dict[str, Any]) -> dict[str, Any]:
    repaired = deepcopy(payload)
    findings = repaired.get("findings")
    if not isinstance(findings, list):
        findings = []
        repaired["findings"] = findings

    normalized_findings: list[dict[str, Any]] = []
    for index, raw_finding in enumerate(findings, start=1):
        if not isinstance(raw_finding, dict):
            continue

        finding = dict(raw_finding)
        finding["finding_id"] = str(finding.get("finding_id") or f"F-{index:03d}")
        finding["clause_title"] = str(finding.get("clause_title") or finding.get("current_text") or f"조문 {index}")
        finding["current_text"] = str(finding.get("current_text") or "")
        finding["suggested_text"] = str(finding.get("suggested_text") or finding.get("current_text") or "")
        finding["reason"] = str(finding.get("reason") or "하이브리드 검토 결과에 따라 수동 확인이 필요합니다.")

        priority = str(finding.get("priority") or "normal").strip()
        if priority not in _PRIORITY_VALUES:
            priority = "normal"
        finding["priority"] = priority

        review_type = str(finding.get("review_type") or "recommendation").strip()
        review_type = _REVIEW_TYPE_ALIASES.get(review_type, review_type)
        if review_type not in _REVIEW_TYPE_VALUES:
            review_type = "recommendation"
        finding["review_type"] = review_type

        related_laws = finding.get("related_laws")
        if not isinstance(related_laws, list):
            related_laws = []
        finding["related_laws"] = [str(item) for item in related_laws if str(item).strip()]

        normalized_findings.append(finding)

    repaired["findings"] = normalized_findings

    summary = repaired.get("summary")
    if not isinstance(summary, dict):
        summary = {}
        repaired["summary"] = summary

    summary["company_name"] = str(summary.get("company_name") or "검토 대상 회사")
    summary["standard_version"] = str(summary.get("standard_version") or "MOEL Standard Employment Rules 2026-02")
    summary["review_date"] = str(summary.get("review_date") or date.today().isoformat())

    summary["total_findings"] = len(normalized_findings)
    summary["critical_count"] = sum(1 for finding in normalized_findings if finding["priority"] == "critical")
    summary["urgent_count"] = sum(1 for finding in normalized_findings if finding["priority"] == "urgent")
    summary["important_count"] = sum(1 for finding in normalized_findings if finding["priority"] == "important")
    summary["normal_count"] = sum(1 for finding in normalized_findings if finding["priority"] == "normal")
    summary["reference_count"] = sum(1 for finding in normalized_findings if finding["priority"] == "reference")
    summary["top_findings"] = [finding["reason"] for finding in normalized_findings[:5]]

    for list_field in ("clause_mappings", "required_item_checks", "optional_recommendations"):
        value = repaired.get(list_field)
        if not isinstance(value, list):
            repaired[list_field] = []

    user_confirmations = repaired.get("user_confirmations")
    if not isinstance(user_confirmations, list):
        user_confirmations = []
    normalized_confirmations: list[dict[str, Any]] = []
    for index, raw_item in enumerate(user_confirmations, start=1):
        if not isinstance(raw_item, dict):
            continue
        clause_title = str(raw_item.get("clause_title") or raw_item.get("clause_key") or f"확인 항목 {index}")
        question = str(raw_item.get("question") or raw_item.get("required_action") or "사업장 정책 확인이 필요합니다.")
        background = str(raw_item.get("background") or raw_item.get("content") or "사업장 특성 반영이 필요한 항목입니다.")
        options = raw_item.get("options")
        if not isinstance(options, list) or len(options) < 2:
            options = ["반영", "미반영"]
        normalized_confirmations.append(
            {
                "item_id": str(raw_item.get("item_id") or f"UC-{index:03d}"),
                "clause_title": clause_title,
                "question": question,
                "background": background,
                "options": [str(option) for option in options],
                "recommendation": str(raw_item.get("recommendation")) if raw_item.get("recommendation") else None,
            }
        )
    repaired["user_confirmations"] = normalized_confirmations

    return repaired
