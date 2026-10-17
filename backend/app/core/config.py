from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Memora backend."""

    APP_NAME: str = "Memora"
    APP_ENV: str = "development"
    DEBUG: bool = True

    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = (
        "postgresql+psycopg://memora:change_me@localhost:5432/memora"
    )

    JWT_SECRET_KEY: SecretStr
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ISSUER: str = "memora"

    # -- Refresh-token cookie --
    REFRESH_COOKIE_NAME: str = "refresh_token"
    COOKIE_SECURE: bool = False  # True in production (HTTPS)
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str | None = None

    # -- CORS / frontend --
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]
    FRONTEND_URL: str = "http://localhost:5173"

    # -- Password policy --
    PASSWORD_MIN_LENGTH: int = 8

    # -- Email verification / password reset --
    EMAIL_TOKEN_EXPIRE_HOURS: int = 24
    PASSWORD_RESET_EXPIRE_HOURS: int = 1

    # -- Media (Cloudinary) --
    # Dummy default keeps the app bootable; media endpoints fail closed
    # with a config error until real credentials are provided.
    CLOUDINARY_URL: SecretStr = SecretStr(
        "cloudinary://000000000000000:xxxxxxxxxxxxxxxxxxxxxxxxxxxx@dummy-cloud"
    )
    CLOUDINARY_FOLDER: str = "memora"
    MEDIA_MAX_IMAGE_MB: int = 10
    MEDIA_MAX_VIDEO_MB: int = 200
    MEDIA_ALLOWED_IMAGE_TYPES: list[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]
    MEDIA_ALLOWED_VIDEO_TYPES: list[str] = [
        "video/mp4",
        "video/quicktime",
        "video/webm",
    ]
    MEDIA_MAX_FILES_PER_POST: int = 10

    # -- Rate limiting (Redis-backed; falls back to in-memory) --
    REDIS_URL: str = "redis://localhost:6380/0"
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_LOGIN_PER_MIN: int = 10
    RATE_LIMIT_REGISTER_PER_MIN: int = 10
    RATE_LIMIT_SENSITIVE_PER_MIN: int = 5  # verify-email, password flows
    RATE_LIMIT_DEFAULT_PER_MIN: int = 100

    # -- Hardening --
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1", "testserver"]
    MAX_BODY_BYTES: int = 1_048_576  # 1 MB (media goes direct to storage)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Create and cache the application settings."""
    return Settings()


settings = get_settings()