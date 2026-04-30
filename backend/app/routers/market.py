"""
app/routers/market.py
──────────────────────
시장 데이터 엔드포인트.

GET /api/v1/market/quote?symbol=005930&is_mock=true    현재가 조회
GET /api/v1/market/orderbook?symbol=005930&is_mock=true 호가 조회
GET /api/v1/market/chart?symbol=005930&period=D&is_mock=true 차트 OHLCV
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
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    current_user: TokenData = Depends(get_current_user),
):
    """KIS API 를 통해 국내 주식 현재가를 조회합니다."""
    data = await kis_client.get_quote(
        symbol,
        user_id=current_user.user_id,
        is_mock=is_mock,
    )
    return QuoteResponse(
        **data,
        fetched_at=datetime.now(tz=timezone.utc),
    )


@router.get("/orderbook", summary="호가 조회")
async def get_orderbook(
    symbol: str = Query(..., min_length=6, max_length=6, description="종목코드"),
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    current_user: TokenData = Depends(get_current_user),
):
    """KIS API 를 통해 매도/매수 호가 5단계를 조회합니다."""
    return await kis_client.get_orderbook(
        symbol,
        user_id=current_user.user_id,
        is_mock=is_mock,
    )


@router.get("/chart", summary="차트 데이터 (OHLCV)")
async def get_chart(
    symbol: str = Query(..., min_length=6, max_length=6, description="종목코드"),
    period: str = Query("D", description="D=일봉 W=주봉 M=월봉"),
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    current_user: TokenData = Depends(get_current_user),
):
    """KIS API 를 통해 기간별 주가 OHLCV 데이터를 조회합니다."""
    return await kis_client.get_chart_data(
        symbol,
        user_id=current_user.user_id,
        period=period,
        is_mock=is_mock,
    )


@router.get("/info", summary="투자정보 조회 (시가총액·상한가·PER·52주 범위 등)")
async def get_stock_info(
    symbol: str = Query(..., min_length=6, max_length=6, description="종목코드"),
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    current_user: TokenData = Depends(get_current_user),
):
    """시가총액·상한가·하한가·PER·배당수익률·52주 범위를 조회합니다."""
    return await kis_client.get_stock_info(
        symbol,
        user_id=current_user.user_id,
        is_mock=is_mock,
    )
