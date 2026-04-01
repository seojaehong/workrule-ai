from pydantic import Field

from app.domain.schemas.review import BaseStrictModel


class ExtractedDocument(BaseStrictModel):
    filename: str
    parser: str
    media_type: str | None = None
    extracted_text: str = Field(min_length=1)
    normalized_text: str = Field(min_length=1)
    char_count: int = Field(ge=1)
    line_count: int = Field(ge=1)
