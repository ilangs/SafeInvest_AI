"""
app/routers/market.py
──────────────────────
시장 데이터 엔드포인트.

GET /api/v1/market/quote?symbol=005930&is_mock=true    현재가 조회
GET /api/v1/market/orderbook?symbol=005930&is_mock=true 호가 조회
GET /api/v1/market/chart?symbol=005930&period=D&is_mock=true 차트 OHLCV
GET /api/v1/market/search?q=삼성&limit=10              종목 검색 (이름/코드)
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import QuoteResponse
from app.services import kis_client

router = APIRouter(prefix="/api/v1/market", tags=["market"])

# 인기 종목 fallback 목록 (Supabase stock_companies 비어 있을 때 사용)
_POPULAR = [
    {"code": "005930", "name": "삼성전자",        "market": "KOSPI"},
    {"code": "000660", "name": "SK하이닉스",       "market": "KOSPI"},
    {"code": "035420", "name": "NAVER",            "market": "KOSPI"},
    {"code": "005380", "name": "현대차",           "market": "KOSPI"},
    {"code": "000270", "name": "기아",             "market": "KOSPI"},
    {"code": "051910", "name": "LG화학",           "market": "KOSPI"},
    {"code": "006400", "name": "삼성SDI",          "market": "KOSPI"},
    {"code": "035720", "name": "카카오",           "market": "KOSPI"},
    {"code": "373220", "name": "LG에너지솔루션",   "market": "KOSPI"},
    {"code": "207940", "name": "삼성바이오로직스", "market": "KOSPI"},
    {"code": "068270", "name": "셀트리온",         "market": "KOSPI"},
    {"code": "055550", "name": "신한지주",         "market": "KOSPI"},
    {"code": "105560", "name": "KB금융",           "market": "KOSPI"},
    {"code": "086790", "name": "하나금융지주",     "market": "KOSPI"},
    {"code": "316140", "name": "우리금융지주",     "market": "KOSPI"},
    {"code": "005490", "name": "POSCO홀딩스",      "market": "KOSPI"},
    {"code": "066570", "name": "LG전자",           "market": "KOSPI"},
    {"code": "003550", "name": "LG",               "market": "KOSPI"},
    {"code": "028260", "name": "삼성물산",         "market": "KOSPI"},
    {"code": "012330", "name": "현대모비스",       "market": "KOSPI"},
    {"code": "009150", "name": "삼성전기",         "market": "KOSPI"},
    {"code": "018260", "name": "삼성에스디에스",   "market": "KOSPI"},
    {"code": "017670", "name": "SK텔레콤",         "market": "KOSPI"},
    {"code": "030200", "name": "KT",               "market": "KOSPI"},
    {"code": "032640", "name": "LG유플러스",       "market": "KOSPI"},
    {"code": "034730", "name": "SK",               "market": "KOSPI"},
    {"code": "096770", "name": "SK이노베이션",     "market": "KOSPI"},
    {"code": "003490", "name": "대한항공",         "market": "KOSPI"},
    {"code": "011200", "name": "HMM",              "market": "KOSPI"},
    {"code": "032830", "name": "삼성생명",         "market": "KOSPI"},
    {"code": "000100", "name": "유한양행",         "market": "KOSPI"},
    {"code": "036570", "name": "엔씨소프트",       "market": "KOSPI"},
    {"code": "259960", "name": "크래프톤",         "market": "KOSPI"},
    {"code": "251270", "name": "넷마블",           "market": "KOSPI"},
    {"code": "352820", "name": "하이브",           "market": "KOSPI"},
    {"code": "010130", "name": "고려아연",         "market": "KOSPI"},
    {"code": "009830", "name": "한화솔루션",       "market": "KOSPI"},
    {"code": "000720", "name": "현대건설",         "market": "KOSPI"},
    {"code": "139480", "name": "이마트",           "market": "KOSPI"},
    {"code": "086520", "name": "에코프로",         "market": "KOSDAQ"},
    {"code": "247540", "name": "에코프로비엠",     "market": "KOSDAQ"},
    {"code": "196170", "name": "알테오젠",         "market": "KOSDAQ"},
    {"code": "293490", "name": "카카오게임즈",     "market": "KOSDAQ"},
    {"code": "263750", "name": "펄어비스",         "market": "KOSDAQ"},
    {"code": "041510", "name": "에스엠",           "market": "KOSDAQ"},
    {"code": "035900", "name": "JYP Ent.",         "market": "KOSDAQ"},
    {"code": "145020", "name": "휴젤",             "market": "KOSDAQ"},
    {"code": "047050", "name": "포스코인터내셔널", "market": "KOSPI"},
    {"code": "011170", "name": "롯데케미칼",       "market": "KOSPI"},
    {"code": "023530", "name": "롯데쇼핑",         "market": "KOSPI"},
]


@router.get("/search", summary="종목 검색 (이름/코드 자동완성)")
async def search_stocks(
    q: str = Query(..., min_length=1, description="종목명 또는 코드 앞자리"),
    limit: int = Query(10, ge=1, le=30),
    _: TokenData = Depends(get_current_user),
):
    """stocks 테이블 검색 → 없으면 인기 종목 fallback."""
    try:
        from app.core.supabase import supabase_admin
        if q.isdigit():
            res = (
                supabase_admin.table("stocks")
                .select("ticker,name,market")
                .ilike("ticker", f"{q}%")
                .limit(limit)
                .execute()
            )
        else:
            res = (
                supabase_admin.table("stocks")
                .select("ticker,name,market")
                .ilike("name", f"%{q}%")
                .limit(limit)
                .execute()
            )
        if res.data:
            return [
                {"code": r["ticker"], "name": r["name"], "market": r.get("market", "")}
                for r in res.data
            ]
    except Exception:
        pass

    # fallback: 인기 종목 목록에서 필터링
    q_lower = q.lower()
    matched = [
        s for s in _POPULAR
        if q_lower in s["code"] or q_lower in s["name"].lower()
    ]
    return matched[:limit]


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


@router.get("/info", summary="투자정보 (시가총액·상한가·하한가·PER·52주)")
async def get_stock_info(
    symbol: str = Query(..., min_length=6, max_length=6, description="종목코드"),
    is_mock: bool = Query(True, description="True=모의투자, False=실거래"),
    current_user: TokenData = Depends(get_current_user),
):
    """KIS API 를 통해 시가총액·상한가·하한가·PER·배당수익률·52주 범위를 조회합니다."""
    return await kis_client.get_stock_info(
        symbol,
        user_id=current_user.user_id,
        is_mock=is_mock,
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


