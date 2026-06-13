"""Application settings.

Loaded once at process start. All env access goes through this module so we
have a single, typed source of truth and can fail fast on misconfiguration.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────
    app_name: str = "ScrumfolksTMS"
    app_env: Literal["development", "staging", "production", "test"] = "production"
    app_debug: bool = False
    app_base_url: str = "https://tasks.scrumfolks.com"
    timezone: str = "Asia/Kolkata"

    allowed_hosts: list[str] = Field(default_factory=lambda: ["*"])
    allowed_origins: list[str] = Field(
        default_factory=lambda: ["https://tasks.scrumfolks.com"]
    )

    # ── Security ─────────────────────────────────────────────────────────
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 10080  # 7 days
    cron_secret: str = "change-me"

    # Must match the Next.js frontend's cookie (sf_sess) so both servers can
    # verify the same JWT independently. The Next.js middleware gates routes
    # without round-tripping the backend.
    cookie_name: str = "sf_sess"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_domain: str | None = None

    # ── Database ─────────────────────────────────────────────────────────
    database_url: str = "postgresql+psycopg://tms:tms@localhost:5432/scrumfolks_tms"
    database_pool_size: int = 20
    database_max_overflow: int = 10

    # ── Redis ────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Email ────────────────────────────────────────────────────────────
    email_provider: Literal["resend", "smtp", "console"] = "console"
    email_from: str = "Scrumfolks TMS <noreply@scrumfolks.com>"

    resend_api_key: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True

    # ── AI ───────────────────────────────────────────────────────────────
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-20250514"

    # ── Scheduler ────────────────────────────────────────────────────────
    enable_scheduler: bool = True
    digest_hour: int = 9
    digest_minute: int = 0
    risk_scan_hour: int = 8
    risk_scan_minute: int = 0

    # ── Seed / Bootstrap ─────────────────────────────────────────────────
    # Demo seed (9 sample users + brands + tasks) — only for demos.
    seed_password: str = "scrumfolks2026"

    # Production bootstrap: create exactly ONE owner account on first boot so
    # the client can log in and onboard everyone else through the Team UI.
    # No other seed data is created. Leave the password blank to skip
    # bootstrap entirely (e.g. when the owner already exists).
    bootstrap_owner_name: str = "Rushabh Shah"
    bootstrap_owner_email: str = "owner@scrumfolks.com"
    bootstrap_owner_password: str | None = None

    @field_validator("allowed_hosts", "allowed_origins", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_db_scheme(cls, value: object) -> object:
        """Force the psycopg v3 driver.

        Managed hosts (Railway, Render, Heroku, …) hand out plain
        `postgres://` / `postgresql://` URLs, which SQLAlchemy maps to the
        psycopg2 dialect that we do not install. Rewrite the scheme so the
        same URL works everywhere without manual editing.
        """
        if isinstance(value, str) and value:
            for prefix in ("postgresql+psycopg://", "postgresql+psycopg2://", "postgresql+asyncpg://"):
                if value.startswith(prefix):
                    return value
            if value.startswith("postgresql://"):
                return "postgresql+psycopg://" + value[len("postgresql://") :]
            if value.startswith("postgres://"):
                return "postgresql+psycopg://" + value[len("postgres://") :]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
