"""
app/routers/order.py
─────────────────────
주문 엔드포인트.

POST /api/v1/order   주문 요청 (body.is_mock 으로 모의/실거래 분기)
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import OrderRequest, OrderResponse
from app.services import kis_client

router = APIRouter(prefix="/api/v1/order", tags=["order"])


@router.post(
    "",
    response_model=OrderResponse,
    summary="주식 주문",
)
async def place_order(
    body: OrderRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """
    모의/실거래 주문을 KIS API 로 전송합니다.
    - body.is_mock=True  : 모의투자 환경
    - body.is_mock=False : 실거래
    """
    data = await kis_client.place_order(
        user_id=current_user.user_id,
        symbol=body.symbol,
        order_type=body.order_type,
        quantity=body.quantity,
        price=body.price,
        is_mock=body.is_mock,
    )
    return OrderResponse(
        **data,
        ordered_at=datetime.now(tz=timezone.utc),
    )
