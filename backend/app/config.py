from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://shpora:shpora@localhost:5433/shpora"

    SECRET_KEY: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    MEDIA_DIR: str = "media"
    MEDIA_URL: str = "/media"
    MAX_UPLOAD_MB: int = 20
    MAX_AVATAR_MB: int = 5
    MAX_FILES_PER_POST: int = 10

    ADMIN_EMAIL: str = "admin@shpora.ru"
    ADMIN_PASSWORD: str = "admin12345"
    ADMIN_NICKNAME: str = "admin"

    WARNINGS_TO_AUTO_BAN: int = 3
    CORS_ORIGINS: str = "*"
    SEED_DEMO_DATA: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
