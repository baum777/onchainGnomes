"""Pydantic Settings for application configuration."""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment and .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # X API (OAuth 1.0a)
    x_api_key: str = Field(default="", alias="X_API_KEY")
    x_api_secret: str = Field(default="", alias="X_API_SECRET")
    x_access_token: str = Field(default="", alias="X_ACCESS_TOKEN")
    x_access_secret: str = Field(default="", alias="X_ACCESS_SECRET")

    # xAI API
    xai_api_key: str = Field(default="", alias="XAI_API_KEY")

    # Application
    debug: bool = Field(default=False, alias="DEBUG")
    dry_run: bool = Field(default=False, alias="DRY_RUN")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # State
    state_db_path: str = Field(
        default="state/agent_state.db",
        alias="STATE_DB_PATH",
    )

    # Scheduler
    scheduler_interval_seconds: int = Field(
        default=60,
        alias="SCHEDULER_INTERVAL_SECONDS",
    )

    # xAI model
    xai_model: str = Field(default="grok-2", alias="XAI_MODEL")

    # Paths
    prompts_dir: Path = Field(default_factory=lambda: Path("prompts"))
    config_dir: Path = Field(default_factory=lambda: Path("config"))

    @property
    def state_db(self) -> Path:
        """Resolved path to state database."""
        return Path(self.state_db_path)


def get_settings() -> Settings:
    """Get application settings (singleton pattern via function)."""
    return Settings()
