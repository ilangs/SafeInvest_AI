"""
app/routers/orders.py
──────────────────────
주문(매매) 내역 엔드포인트.

GET /api/v1/orders/today    당일 주문내역 (체결/미체결)
GET /api/v1/orders/history  기간 매매내역 (Supabase user_orders 기반)
"""

from typing import Optional
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


@router.get("/history", summary="기간 매매내역 조회")
async def get_order_history(
    is_mock:    bool          = Query(True),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD 또는 YYYYMMDD"),
    end_date:   Optional[str] = Query(None, description="YYYY-MM-DD 또는 YYYYMMDD"),
    current_user: TokenData   = Depends(get_current_user),
):
    """
    Supabase user_orders 테이블에서 기간별 매매내역을 조회합니다.
    날짜 미지정 시 오늘 하루.
    """
    return await kis_client.get_order_history(
        user_id    = current_user.user_id,
        is_mock    = is_mock,
        start_date = start_date,
        end_date   = end_date,
    )
