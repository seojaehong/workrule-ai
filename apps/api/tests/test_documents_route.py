from urllib.parse import quote
from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_draft_document_service, get_hwpx_export_service
from app.api.routes.documents import router
from app.domain.schemas.documents import DraftGenerationResult
from app.services.draft_document_service import DraftDocumentService
from app.services.hwpx_export_service import HWPXExportService


class StubDraftDocumentService(DraftDocumentService):
    def generate(self, request: object) -> DraftGenerationResult:  # type: ignore[override]
        company_name = getattr(request, "company_name")
        return DraftGenerationResult(
            company_name=company_name,
            draft_title="내산 최신 취업규칙 초안",
            export_filename="내산_최신_취업규칙_초안.hwpx",
            draft_plain_text="내산 최신 취업규칙 초안\n\n제1조 목적",
            draft_markdown="# 내산 최신 취업규칙 초안\n\n제1조 목적",
            applied_replacements=1,
            inserted_clauses=0,
            section_count=1,
            sections=["제1조 목적"],
            unresolved_findings=[],
        )


class StubHWPXExportService(HWPXExportService):
    def __init__(self) -> None:
        pass

    def export(self, *, filename: str, draft_text: str) -> tuple[str, bytes]:
        return filename, draft_text.encode("utf-8")

    @staticmethod
    def build_content_disposition(filename: str) -> str:
        return f"attachment; filename*=UTF-8''{quote(filename)}"


def _build_payload() -> dict:
    return {
        "company_name": "테스트 회사",
        "baseline_rule_text": "제1조 목적",
        "diagnosis_result": {
            "summary": {
                "company_name": "테스트 회사",
                "standard_version": "MOEL Standard Employment Rules 2026-02",
                "review_date": date(2026, 4, 2).isoformat(),
                "total_findings": 0,
                "critical_count": 0,
                "urgent_count": 0,
                "important_count": 0,
                "normal_count": 0,
                "reference_count": 0,
                "top_findings": [],
            },
            "clause_mappings": [],
            "required_item_checks": [],
            "findings": [],
            "user_confirmations": [],
            "optional_recommendations": [],
        },
    }


def test_generate_draft_route_returns_structured_payload() -> None:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_draft_document_service] = lambda: StubDraftDocumentService()

    client = TestClient(app)
    response = client.post("/api/v1/documents/generate-draft", json=_build_payload())

    assert response.status_code == 200
    assert response.json()["draft_title"] == "내산 최신 취업규칙 초안"


def test_export_hwpx_route_returns_binary() -> None:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_draft_document_service] = lambda: StubDraftDocumentService()
    app.dependency_overrides[get_hwpx_export_service] = lambda: StubHWPXExportService()

    client = TestClient(app)
    response = client.post("/api/v1/documents/export-hwpx", json=_build_payload())

    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith("attachment;")
