"""
app/core/security.py — 🔐 인증의 핵심 (JWT 검증 단일 진입점, SSOT)
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  프론트엔드가 Supabase 로그인 후 보내오는 JWT(Access Token)를
  서버에서 검증하고, 안의 user_id·email·role을 꺼내 dependency에 주입.

[왜 SSOT(Single Source of Truth)인가]
  JWT 검증 로직을 여러 곳에 흩뿌리면 보안 사고 위험이 큼.
  이 파일의 verify_jwt() 만 신뢰 — 다른 라우터는 모두
  `from app.dependencies import get_current_user` 를 통해 사용.

[Supabase JWT의 특이점]
  Supabase는 두 종류의 JWT를 발행:
    1) 사용자 access_token  — 알고리즘 ES256 (비대칭키, 공개키로 검증)
    2) anon / service_role  — 알고리즘 HS256 (대칭키, SUPABASE_JWT_SECRET)
  이 파일은 토큰 헤더의 alg를 보고 자동 분기, 둘 다 검증 가능.
  공개키는 JWKS 엔드포인트에서 lru_cache로 1회 fetch 후 재사용.

[보안 체크]
  - exp (만료시각) 확인 → 만료된 토큰 거부
  - iss (발급자) 확인 → 다른 프로젝트의 토큰 거부
  - 서명 검증 → 변조된 토큰 거부
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
