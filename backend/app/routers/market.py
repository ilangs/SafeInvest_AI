"""
app/routers/market.py
──────────────────────
시장 데이터 엔드포인트.

GET /api/v1/market/quote?symbol=005930   현재가 조회
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import QuoteResponse
from app.services import kis_client

router = APIRouter(prefix="/api/v1/market", tags=["market"])


@router.get(
    "/quote",
    response_model=QuoteResponse,
    summary="주식 현재가 조회",
)
async def get_quote(
    symbol: str = Query(..., description="종목코드 (예: 005930)", min_length=6, max_length=6),
    _: TokenData = Depends(get_current_user),    # 인증 필요, user 정보는 사용 안 함
):
    """
    KIS API 를 통해 국내 주식 현재가를 조회합니다.
    symbol : 6자리 종목코드 (예: 005930=삼성전자, 000660=SK하이닉스)
    """
    data = await kis_client.get_quote(symbol)
    return QuoteResponse(
        **data,
        fetched_at=datetime.now(tz=timezone.utc),
    )
