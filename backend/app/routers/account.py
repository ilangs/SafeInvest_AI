"""
app/routers/account.py
───────────────────────
KIS 계좌 조회 엔드포인트 (중계).

GET /api/v1/account/balance    잔고·매수가능금액
GET /api/v1/account/holdings   보유종목 목록
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import AccountBalanceResponse, HoldingItem
from app.services import kis_client

router = APIRouter(prefix="/api/v1/account", tags=["account"])


@router.get(
    "/balance",
    response_model=AccountBalanceResponse,
    summary="잔고·매수가능금액 조회",
)
async def get_balance(_: TokenData = Depends(get_current_user)):
    return await kis_client.get_balance()


@router.get(
    "/holdings",
    response_model=list[HoldingItem],
    summary="보유종목 목록 조회",
)
async def get_holdings(_: TokenData = Depends(get_current_user)):
    return await kis_client.get_holdings()
