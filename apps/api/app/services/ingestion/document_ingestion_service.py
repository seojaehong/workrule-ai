from io import BytesIO
import os
import xml.etree.ElementTree as ET
from zipfile import ZipFile

from docx import Document
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

from app.domain.schemas.ingestion import ExtractedDocument
from app.services.ingestion.text_normalizer import normalize_extracted_text


class DocumentIngestionService:
    async def extract_text(self, file: UploadFile) -> ExtractedDocument:
        filename = file.filename or "uploaded-file"
        suffix = os.path.splitext(filename)[1].lower()
        content = await file.read()

        parser_name, extracted_text = self._extract_with_parser(suffix=suffix, content=content)
        normalized_text = normalize_extracted_text(extracted_text)
        if not normalized_text:
            raise HTTPException(status_code=422, detail="The uploaded file did not contain extractable text.")

        return ExtractedDocument(
            filename=filename,
            parser=parser_name,
            media_type=file.content_type,
            extracted_text=extracted_text,
            normalized_text=normalized_text,
            char_count=len(normalized_text),
            line_count=len(normalized_text.splitlines()),
        )

    def _extract_with_parser(self, *, suffix: str, content: bytes) -> tuple[str, str]:
        if suffix in {".txt", ".md"}:
            return "plain_text", content.decode("utf-8-sig", errors="ignore")
        if suffix == ".pdf":
            return "pdf", self._extract_pdf_text(content)
        if suffix == ".docx":
            return "docx", self._extract_docx_text(content)
        if suffix == ".hwpx":
            return "hwpx", self._extract_hwpx_text(content)
        if suffix == ".hwp":
            raise HTTPException(
                status_code=415,
                detail="Legacy .hwp parsing is not supported yet. Please convert to .hwpx, .docx, .pdf, or text.",
            )
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {suffix or 'unknown'}. Use .txt, .md, .pdf, .docx, or .hwpx.",
        )

    def _extract_pdf_text(self, content: bytes) -> str:
        reader = PdfReader(BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)

    def _extract_docx_text(self, content: bytes) -> str:
        document = Document(BytesIO(content))
        paragraphs = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
        return "\n".join(paragraphs)

    def _extract_hwpx_text(self, content: bytes) -> str:
        texts: list[str] = []
        with ZipFile(BytesIO(content)) as archive:
            section_names = sorted(
                name for name in archive.namelist() if name.startswith("Contents/section") and name.endswith(".xml")
            )
            if not section_names:
                raise HTTPException(status_code=422, detail="The .hwpx file did not contain readable section XML.")

            for section_name in section_names:
                root = ET.fromstring(archive.read(section_name))
                for node in root.iter():
                    if node.text and node.text.strip():
                        texts.append(node.text.strip())

        return "\n".join(texts)
