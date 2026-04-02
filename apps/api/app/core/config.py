from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o-mini"
    openai_max_retries: int = 3
    upstage_api_key: SecretStr | None = None
    ingestion_ocr_provider: Literal["disabled", "openai", "upstage"] = "upstage"
    ingestion_ocr_model: str = "gpt-4o-mini"
    ingestion_ocr_max_pages: int = 30
    ingestion_ocr_render_scale: float = 2.0
    ingestion_ocr_timeout_seconds: float = 120.0
    ingestion_ocr_output_format: Literal["markdown", "text", "html"] = "markdown"
    cors_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]
    llm_mode: Literal["mock", "openai"] = "mock"

    def has_openai_api_key(self) -> bool:
        if self.openai_api_key is None:
            return False

        resolved = self.openai_api_key.get_secret_value().strip()
        if not resolved:
            return False

        return not resolved.startswith("<")

    def has_upstage_api_key(self) -> bool:
        if self.upstage_api_key is None:
            return False

        resolved = self.upstage_api_key.get_secret_value().strip()
        if not resolved:
            return False

        return not resolved.startswith("<")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
