"""
app/core/security.py
─────────────────────
JWT 검증 단일 진입점 (SSOT).

규칙:
  - JWT 발급 : Supabase Auth 만 합니다.
  - JWT 검증 : 이 파일의 verify_jwt() 만 합니다.
  - ③ AI Layer 는 이 함수를 주입받아 사용합니다. 독립 구현 금지.

Supabase JWT 구조:
  header.payload.signature
  payload 에 `sub` (user UUID), `role`, `exp`, `aud` 등이 포함됩니다.
"""

from datetime import datetime, timezone
from typing import Any
import jwt
from fastapi import HTTPException, status
from app.core.config import settings


class TokenData:
    """검증된 JWT 에서 추출한 사용자 정보."""
    def __init__(self, payload: dict[str, Any]):
        self.user_id: str  = payload["sub"]          # Supabase user UUID
        self.email: str    = payload.get("email", "")
        self.role: str     = payload.get("role", "authenticated")
        self.exp: int      = payload["exp"]


def verify_jwt(token: str) -> TokenData:
    """
    Supabase JWT 를 검증하고 TokenData 를 반환합니다.

    실패 시 HTTP 401 을 raise 합니다.
    """
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",        # Supabase 기본 aud 값
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었습니다. 다시 로그인해 주세요.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 토큰입니다: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 만료 이중 확인 (PyJWT 가 처리하지만 명시적으로 남겨둠)
    exp = payload.get("exp", 0)
    if datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었습니다.",
        )

    return TokenData(payload)
