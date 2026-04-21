"""
app/routers/auth.py
────────────────────
인증 관련 엔드포인트.

GET /api/v1/auth/verify
  - 현재 JWT 가 유효한지 확인합니다.
  - Frontend 가 "내 토큰이 살아있나?" 를 체크할 때 사용합니다.
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import AuthVerifyResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get(
    "/verify",
    response_model=AuthVerifyResponse,
    summary="JWT 유효성 확인",
)
async def verify_token(current_user: TokenData = Depends(get_current_user)):
    """
    유효한 JWT 를 가진 사용자의 기본 정보를 반환합니다.
    토큰이 유효하지 않으면 401 을 반환합니다.
    """
    return AuthVerifyResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        role=current_user.role,
    )
