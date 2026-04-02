import base64
import logging
from typing import Any, Protocol

import fitz
from fastapi import HTTPException
from openai import AsyncOpenAI


logger = logging.getLogger(__name__)


class VisionOCRService(Protocol):
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
        except Exception as exc:  # pragma: no cover - defensive guard for malformed PDFs
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
