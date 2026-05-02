"""
app/routers/account.py
───────────────────────
KIS 계좌 조회 엔드포인트.

GET /api/v1/account/balance?is_mock=true    잔고·매수가능금액
GET /api/v1/account/holdings?is_mock=true   보유종목 목록
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import AccountBalanceResponse, HoldingItem
from app.services import kis_client

router = APIRouter(prefix="/api/v1/account", tags=["account"])

_FALLBACK_BALANCE = AccountBalanceResponse(
    deposit=0, available=0, total_eval=0,
    total_profit_loss=0, account_no_masked=None,
)


@router.get(
    "/balance",
    response_model=AccountBalanceResponse,
    summary="잔고·매수가능금액 조회",
)
async def get_balance(
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        return await kis_client.get_balance(
            user_id=current_user.user_id,
            is_mock=is_mock,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"KIS 잔고 조회 실패: {str(e)[:120]}")


@router.get(
    "/holdings",
    response_model=list[HoldingItem],
    summary="보유종목 목록 조회",
)
async def get_holdings(
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    current_user: TokenData = Depends(get_current_user),
):
    try:
        return await kis_client.get_holdings(
            user_id=current_user.user_id,
            is_mock=is_mock,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"KIS 보유종목 조회 실패: {str(e)[:120]}")
