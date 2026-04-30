"""
app/routers/orders.py
──────────────────────
당일 주문내역 엔드포인트.

GET /api/v1/orders/today?is_mock=true&status=ccld     당일 체결 내역
GET /api/v1/orders/today?is_mock=true&status=pending  당일 미체결 내역
"""

from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.services import kis_client

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


@router.get("/today", summary="당일 주문내역 조회")
async def get_today_orders(
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    order_status: str = Query("ccld", description="ccld=체결, pending=미체결"),
    current_user: TokenData = Depends(get_current_user),
):
    """당일 체결 또는 미체결 주문 목록을 반환합니다."""
    return await kis_client.get_today_orders(
        user_id=current_user.user_id,
        is_mock=is_mock,
        order_status=order_status,
    )
