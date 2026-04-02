from pydantic import Field

from app.domain.schemas.review import BaseStrictModel, ReviewDiagnosisResult


class DraftGenerationRequest(BaseStrictModel):
    company_name: str = Field(min_length=1)
    baseline_rule_text: str = Field(min_length=1)
    diagnosis_result: ReviewDiagnosisResult


class DraftGenerationResult(BaseStrictModel):
    company_name: str
    draft_title: str
    export_filename: str
    draft_plain_text: str = Field(min_length=1)
    draft_markdown: str = Field(min_length=1)
    applied_replacements: int = Field(ge=0)
    inserted_clauses: int = Field(ge=0)
    section_count: int = Field(ge=0)
    sections: list[str] = Field(default_factory=list)
    unresolved_findings: list[str] = Field(default_factory=list)
