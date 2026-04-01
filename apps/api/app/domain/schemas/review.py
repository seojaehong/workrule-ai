from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReviewPriority(str, Enum):
    critical = "critical"
    urgent = "urgent"
    important = "important"
    normal = "normal"
    reference = "reference"


class ReviewType(str, Enum):
    violation = "violation"
    required_missing = "required_missing"
    legal_update_missing = "legal_update_missing"
    wording_issue = "wording_issue"
    recommendation = "recommendation"


class MappingStatus(str, Enum):
    matched = "matched"
    missing = "missing"
    custom = "custom"
    partial = "partial"


class BaseStrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        use_enum_values=True,
    )


class ReviewDiagnosisRequest(BaseStrictModel):
    company_name: str = Field(min_length=1)
    company_rule_text: str = Field(min_length=1)
    standard_rule_text: str = Field(min_length=1)
    industry: str | None = None
    employee_count: int | None = Field(default=None, ge=1)
    focus_areas: list[str] = Field(default_factory=list)
    review_date: date | None = None


class RuleMapping(BaseStrictModel):
    company_clause: str
    standard_clause: str | None = None
    status: MappingStatus
    notes: str


class RequiredItemCheck(BaseStrictModel):
    item_key: str
    item_label: str
    is_present: bool
    related_clause: str | None = None
    notes: str


class ReviewFinding(BaseStrictModel):
    finding_id: str
    clause_title: str
    priority: ReviewPriority
    review_type: ReviewType
    related_laws: list[str] = Field(default_factory=list)
    current_text: str
    suggested_text: str
    reason: str


class UserConfirmationItem(BaseStrictModel):
    item_id: str
    clause_title: str
    question: str
    background: str
    options: list[str] = Field(min_length=2)
    recommendation: str | None = None


class ReviewSummary(BaseStrictModel):
    company_name: str
    standard_version: str
    review_date: date
    total_findings: int = Field(ge=0)
    critical_count: int = Field(ge=0)
    urgent_count: int = Field(ge=0)
    important_count: int = Field(ge=0)
    normal_count: int = Field(ge=0)
    reference_count: int = Field(ge=0)
    top_findings: list[str] = Field(default_factory=list, max_length=5)


class ReviewDiagnosisResult(BaseStrictModel):
    summary: ReviewSummary
    clause_mappings: list[RuleMapping] = Field(default_factory=list)
    required_item_checks: list[RequiredItemCheck] = Field(default_factory=list)
    findings: list[ReviewFinding] = Field(default_factory=list)
    user_confirmations: list[UserConfirmationItem] = Field(default_factory=list)
    optional_recommendations: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_summary_counts(self) -> "ReviewDiagnosisResult":
        priority_counts = {
            ReviewPriority.critical.value: 0,
            ReviewPriority.urgent.value: 0,
            ReviewPriority.important.value: 0,
            ReviewPriority.normal.value: 0,
            ReviewPriority.reference.value: 0,
        }
        for finding in self.findings:
            priority_counts[finding.priority] += 1

        if self.summary.total_findings != len(self.findings):
            raise ValueError("summary.total_findings must match the number of findings.")
        if self.summary.critical_count != priority_counts[ReviewPriority.critical.value]:
            raise ValueError("summary.critical_count must match critical findings.")
        if self.summary.urgent_count != priority_counts[ReviewPriority.urgent.value]:
            raise ValueError("summary.urgent_count must match urgent findings.")
        if self.summary.important_count != priority_counts[ReviewPriority.important.value]:
            raise ValueError("summary.important_count must match important findings.")
        if self.summary.normal_count != priority_counts[ReviewPriority.normal.value]:
            raise ValueError("summary.normal_count must match normal findings.")
        if self.summary.reference_count != priority_counts[ReviewPriority.reference.value]:
            raise ValueError("summary.reference_count must match reference findings.")

        return self
