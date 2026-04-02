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
    cors_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]
    llm_mode: Literal["mock", "openai"] = "mock"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
