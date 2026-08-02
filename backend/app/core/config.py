from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PFM AI App"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://pfm_user:pfm_password@127.0.0.1:5432/pfm_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    SECRET_KEY: str = "change-this-secret-key-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # AI APIs
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Bank API
    SETU_CLIENT_ID: Optional[str] = None
    SETU_CLIENT_SECRET: Optional[str] = None
    SETU_BASE_URL: str = "https://prod.setu.co/api"

    # Webhook
    WEBHOOK_SECRET: str = "webhook-secret"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    USER_PHONE_NUMBER: Optional[str] = None

    # SMTP Settings
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@pfm-ai.com"

    class Config:
        env_file = "../../.env"
        extra = "ignore"


settings = Settings()
