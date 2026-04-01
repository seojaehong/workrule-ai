from io import BytesIO

import pytest
from fastapi import UploadFile

from app.services.ingestion.document_ingestion_service import DocumentIngestionService
from app.services.ingestion.text_normalizer import normalize_extracted_text


def test_normalize_extracted_text_collapses_extra_whitespace() -> None:
    raw_text = "제1조(목적)  \r\n\r\n\r\n  회사는   규칙을 둔다.  "

    normalized = normalize_extracted_text(raw_text)

    assert normalized == "제1조(목적)\n\n회사는 규칙을 둔다."


@pytest.mark.asyncio
async def test_document_ingestion_service_extracts_plain_text() -> None:
    service = DocumentIngestionService()
    upload = UploadFile(
        filename="rules.txt",
        file=BytesIO("제1조 목적\n회사는 규칙을 둔다.".encode("utf-8")),
    )

    extracted = await service.extract_text(upload)

    assert extracted.parser == "plain_text"
    assert extracted.normalized_text == "제1조 목적\n회사는 규칙을 둔다."
