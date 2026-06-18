from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    OPENAI_API_KEY: str = "your-api-key"
    FIRECRAWL_API_KEY: str = ""
    JWT_SECRET: str = "your-secret"
    ALLOWED_ORIGINS: str = "*"
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "none"
    ENFORCE_DOMAIN: bool = False
    REDIS_URI: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", extra='ignore')

settings = Settings()
