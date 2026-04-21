"""
app/dependencies.py
────────────────────
FastAPI Depends 공용 의존성.

모든 인증이 필요한 라우터는 아래 의존성을 주입받습니다:
    current_user: TokenData = Depends(get_current_user)

사용 예:
    @router.get("/me")
    async def get_me(current_user: TokenData = Depends(get_current_user)):
        return {"user_id": current_user.user_id}
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import TokenData, verify_jwt


# Authorization: Bearer <token> 헤더를 파싱합니다.
_bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> TokenData:
    """
    요청 헤더의 Bearer 토큰을 검증하고 TokenData 를 반환합니다.
    토큰이 없거나 유효하지 않으면 HTTP 401 을 raise 합니다.
    """
    return verify_jwt(credentials.credentials)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> TokenData | None:
    """
    인증이 선택적인 엔드포인트용.
    토큰이 없으면 None 을 반환합니다.
    """
    if credentials is None:
        return None
    return verify_jwt(credentials.credentials)
