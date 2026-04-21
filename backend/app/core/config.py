"""
app/core/config.py
──────────────────
환경변수 단일 진입점.
모든 모듈은 `from app.core.config import settings` 로 설정을 가져옵니다.
절대로 os.environ 을 직접 읽지 마세요.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Supabase ─────────────────────────────────────────────
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str          # JWT 서명 검증용 (Supabase Dashboard → Settings → API)

    # ── OpenAI ───────────────────────────────────────────────
    openai_api_key: str

    # ── KIS API (한국투자증권) ──────────────────────────────
    kis_app_key: str
    kis_app_secret: str
    kis_account: str                   # .env: KIS_ACCOUNT
    kis_mock: bool = True              # .env: KIS_MOCK  (True=모의투자, False=실거래)

    @property
    def kis_account_no(self) -> str:   # 하위 호환 alias
        return self.kis_account

    @property
    def kis_is_mock(self) -> bool:     # 하위 호환 alias
        return self.kis_mock

    @property
    def kis_base_url(self) -> str:
        if self.kis_mock:
            return "https://openapivts.koreainvestment.com:29443"
        return "https://openapi.koreainvestment.com:9443"

    # ── FastAPI ───────────────────────────────────────────────
    fastapi_env: str = "development"
    fastapi_secret_key: str = "change-me-in-production"
    allowed_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    # ── LangChain (선택) ──────────────────────────────────────
    langchain_tracing_v2: bool = False
    langchain_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    """앱 전체에서 동일한 Settings 인스턴스를 반환합니다."""
    return Settings()


settings = get_settings()
