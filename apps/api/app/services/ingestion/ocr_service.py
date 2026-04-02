import base64
import logging
from typing import Any, Protocol

import fitz
from fastapi import HTTPException
import httpx
from openai import AsyncOpenAI


logger = logging.getLogger(__name__)


class OCRService(Protocol):
    async def extract_pdf_text(self, *, content: bytes, filename: str) -> str:
        ...


class OpenAIVisionOCRService:
    def __init__(
        self,
        *,
        api_key: Any,
        model: str,
        max_pages: int,
        render_scale: float,
    ) -> None:
        resolved_api_key = api_key.get_secret_value() if hasattr(api_key, "get_secret_value") else str(api_key)
        self._client = AsyncOpenAI(api_key=resolved_api_key)
        self._model = model
        self._max_pages = max_pages
        self._render_scale = render_scale

    async def extract_pdf_text(self, *, content: bytes, filename: str) -> str:
        try:
            document = fitz.open(stream=content, filetype="pdf")
        except Exception as exc:  # pragma: no cover
            logger.exception("Failed to open PDF for OCR: %s", filename)
            raise HTTPException(status_code=422, detail="The uploaded PDF could not be opened for OCR.") from exc

        try:
            page_count = document.page_count
            if page_count == 0:
                raise HTTPException(status_code=422, detail="The uploaded PDF does not contain any pages.")

            processed_page_count = min(page_count, self._max_pages)
            logger.info(
                "Starting OpenAI vision OCR for %s with %s/%s pages",
                filename,
                processed_page_count,
                page_count,
            )

            extracted_pages: list[str] = []
            for page_index in range(processed_page_count):
                page = document.load_page(page_index)
                image_url = self._render_page_as_data_url(page)
                response = await self._client.responses.create(
                    model=self._model,
                    input=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": (
                                        "Extract every readable Korean and English character from this employment-rules PDF "
                                        "page. Return plain text only. Preserve headings, article numbers, tables, and line "
                                        "breaks where they help readability. Do not summarize or translate."
                                    ),
                                },
                                {
                                    "type": "input_image",
                                    "image_url": image_url,
                                },
                            ],
                        }
                    ],
                )
                page_text = response.output_text.strip()
                if page_text:
                    extracted_pages.append(page_text)

            extracted_text = "\n\n".join(extracted_pages).strip()
            if extracted_text:
                return extracted_text

            raise HTTPException(status_code=422, detail="Vision OCR could not extract readable text from the uploaded PDF.")
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("OpenAI vision OCR failed for %s", filename)
            raise HTTPException(
                status_code=503,
                detail="Vision OCR failed. Check OPENAI_API_KEY and OCR model settings before retrying.",
            ) from exc
        finally:
            document.close()

    def _render_page_as_data_url(self, page: fitz.Page) -> str:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(self._render_scale, self._render_scale), alpha=False)
        image_bytes = pixmap.tobytes("png")
        encoded_image = base64.b64encode(image_bytes).decode("ascii")
        return f"data:image/png;base64,{encoded_image}"


class UpstageDocumentParseService:
    _endpoint = "https://api.upstage.ai/v1/document-digitization"

    def __init__(
        self,
        *,
        api_key: Any,
        timeout_seconds: float,
        output_format: str,
    ) -> None:
        resolved_api_key = api_key.get_secret_value() if hasattr(api_key, "get_secret_value") else str(api_key)
        self._api_key = resolved_api_key
        self._timeout_seconds = timeout_seconds
        self._output_format = output_format

    async def extract_pdf_text(self, *, content: bytes, filename: str) -> str:
        logger.info("Starting Upstage Document Parse for %s", filename)

        headers = {"Authorization": f"Bearer {self._api_key}"}
        files = {"document": (filename, content, "application/pdf")}
        data = {
            "model": "document-parse",
            "ocr": "force",
            "output_formats": f'[\"{self._output_format}\"]',
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(self._endpoint, headers=headers, files=files, data=data)
        except httpx.HTTPError as exc:
            logger.exception("Upstage Document Parse request failed for %s", filename)
            raise HTTPException(status_code=503, detail="Upstage Document Parse request failed.") from exc

        if response.status_code >= 400:
            logger.error("Upstage Document Parse returned %s for %s: %s", response.status_code, filename, response.text)
            raise HTTPException(
                status_code=503,
                detail=f"Upstage Document Parse failed with status {response.status_code}.",
            )

        payload = response.json()
        content_payload = payload.get("content", {})
        extracted_text = self._pick_best_content(content_payload).strip()
        if extracted_text:
            return extracted_text

        raise HTTPException(status_code=422, detail="Upstage Document Parse did not return readable markdown output.")

    def _pick_best_content(self, content_payload: dict[str, Any]) -> str:
        if not isinstance(content_payload, dict):
            return ""

        preferred = content_payload.get(self._output_format)
        if isinstance(preferred, str) and preferred.strip():
            return preferred

        for key in ("markdown", "text", "html"):
            value = content_payload.get(key)
            if isinstance(value, str) and value.strip():
                return value

        return ""
