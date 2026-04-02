from io import BytesIO
from zipfile import ZipFile

import pytest
from fastapi import HTTPException
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


def test_document_ingestion_service_prefers_hwpx_preview_text() -> None:
    service = DocumentIngestionService()
    archive_buffer = BytesIO()

    with ZipFile(archive_buffer, mode="w") as archive:
        archive.writestr("Preview/PrvText.txt", "표준 취업규칙\n제1조 목적".encode("utf-8"))
        archive.writestr(
            "Contents/section0.xml",
            '<?xml version="1.0" encoding="UTF-8"?><root><p>무시될 본문</p></root>',
        )

    extracted = service._extract_hwpx_text(archive_buffer.getvalue())

    assert extracted == "표준 취업규칙\n제1조 목적"


@pytest.mark.asyncio
async def test_document_ingestion_service_detects_image_only_pdf() -> None:
    service = DocumentIngestionService()

    class EmptyPage:
        def extract_text(self) -> str:
            return ""

    class EmptyReader:
        pages = [EmptyPage()]

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr("app.services.ingestion.document_ingestion_service.PdfReader", lambda _: EmptyReader())

        with pytest.raises(HTTPException) as error:
            await service._extract_pdf_text(content=b"%PDF-1.4", filename="scan.pdf")

    assert error.value.status_code == 422
    assert "Vision OCR is not configured yet" in str(error.value.detail)


@pytest.mark.asyncio
async def test_document_ingestion_service_uses_vision_ocr_for_image_only_pdf() -> None:
    class StubOCRService:
        async def extract_pdf_text(self, *, content: bytes, filename: str) -> str:
            assert filename == "scan.pdf"
            return "제1조 목적\nOCR 추출 본문"

    service = DocumentIngestionService(ocr_service=StubOCRService())

    class EmptyPage:
        def extract_text(self) -> str:
            return ""

    class EmptyReader:
        pages = [EmptyPage()]

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr("app.services.ingestion.document_ingestion_service.PdfReader", lambda _: EmptyReader())
        parser, extracted = await service._extract_pdf_text(content=b"%PDF-1.4", filename="scan.pdf")

    assert parser == "pdf_vision_ocr"
    assert extracted == "제1조 목적\nOCR 추출 본문"


def test_document_ingestion_service_prefers_hwp_preview_text() -> None:
    service = DocumentIngestionService()
    preview_bytes = "표준 취업규칙\n제1조 목적".encode("utf-16le")

    class FakeStream:
        def __init__(self, data: bytes) -> None:
            self._data = data

        def read(self) -> bytes:
            return self._data

    class FakeOleFile:
        def __enter__(self) -> "FakeOleFile":
            return self

        def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
            return None

        def exists(self, name: str) -> bool:
            return name == "PrvText"

        def openstream(self, name: str) -> FakeStream:
            if name != "PrvText":
                raise KeyError(name)
            return FakeStream(preview_bytes)

        def listdir(self, streams: bool = True, storages: bool = False) -> list[list[str]]:
            return []

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr("app.services.ingestion.document_ingestion_service.olefile.OleFileIO", lambda _: FakeOleFile())
        extracted = service._extract_hwp_text(b"fake-hwp")

    assert extracted == "표준 취업규칙\n제1조 목적"
