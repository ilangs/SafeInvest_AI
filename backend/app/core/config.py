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

    # ── 암호화 (Fernet AES-256) ──────────────────────────────
    # 사용자별 KIS API 키를 Supabase DB에 저장할 때 사용
    # KIS 서버 단일 키는 삭제 → user_kis_credentials 테이블로 이동
    encryption_key: str = ""

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
