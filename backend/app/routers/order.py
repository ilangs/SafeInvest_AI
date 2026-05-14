"""
app/routers/order.py — 주식 매수/매도 주문 엔드포인트
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  프론트엔드의 주문 폼 제출 → 이 API → kis_client.place_order() 호출.
  비즈니스 로직은 services/kis_client.py 에 위임하고, 이 파일은 얇은 라우터.

[보안·안전 장치 (kis_client에서 수행)]
  1) JWT 인증 필수 (Depends(get_current_user))
  2) 거래시간 외 주문 거부 (주말·공휴일·정규장 외)
  3) KIS 통신 실패 시 status="rejected" 명시 응답 — 가짜 체결 기록 금지
  4) 주문 성공 시 user_orders 테이블에 "접수" 상태로 기록 (체결은 별도 확인)

[엔드포인트]
  POST /api/v1/order
    body: { symbol, order_type: "buy"|"sell", quantity, price?, is_mock }
    response: { order_id, status: "accepted"|"rejected", message, ... }

[프론트 처리]
  OrderForm.jsx가 응답의 status 필드를 보고 ✅/❌ 메시지 분기.
  단순 HTTP 200만 보고 성공 판단하면 안 됨 (거래시간 거부도 200으로 옴).
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
