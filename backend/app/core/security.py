"""
app/core/security.py
─────────────────────
JWT 검증 단일 진입점 (SSOT).

Supabase 프로젝트가 ES256(비대칭키)을 사용하는 경우:
  - 사용자 access_token: ES256 (eyJhbGciOiJFUzI1NiIs...)
  - anon/service_role key: HS256 (eyJhbGciOiJIUzI1NiIs...)
  - 공개키는 JWKS 엔드포인트에서 자동 취득
"""

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any
import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, status
from app.core.config import settings

# JWKS 클라이언트 캐시 (공개키를 매 요청마다 fetch하지 않도록)
@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)


class TokenData:
    """검증된 JWT 에서 추출한 사용자 정보."""
    def __init__(self, payload: dict[str, Any]):
        self.user_id: str  = payload["sub"]
        self.email: str    = payload.get("email", "")
        self.role: str     = payload.get("role", "authenticated")
        self.exp: int      = payload["exp"]


def verify_jwt(token: str) -> TokenData:
    """
    Supabase JWT 를 검증하고 TokenData 를 반환합니다.
    ES256(JWKS) → HS256(JWT_SECRET) 순으로 시도합니다.
    """
    payload = _try_es256(token) or _try_hs256(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 만료 확인
    exp = payload.get("exp", 0)
    if datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었습니다. 다시 로그인해 주세요.",
        )

    try:
        return TokenData(payload)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"토큰 페이로드 오류: {e}",
        )


def _try_es256(token: str) -> dict | None:
    """JWKS 공개키로 ES256 검증 시도."""
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            options={"verify_aud": False},
        )
        return payload
    except Exception:
        return None


def _try_hs256(token: str) -> dict | None:
    """JWT Secret으로 HS256 검증 시도 (anon/service_role 호환)."""
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except Exception:
        return None
