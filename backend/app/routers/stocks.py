"""
app/routers/stocks.py
──────────────────────
종목 분석 데이터 엔드포인트 (analysis 모듈 통합).

GET  /api/v1/stocks                         전체 종목 목록
GET  /api/v1/stocks/{ticker}                종목 기본정보
GET  /api/v1/stocks/{ticker}/score          안전점수 (100점 등급제)
GET  /api/v1/stocks/{ticker}/financials     재무제표 (분기/연간)
GET  /api/v1/stocks/{ticker}/prices         가격 + 기술지표 (MA·BB·RSI·MACD)
GET  /api/v1/stocks/{ticker}/warnings       위험 경고 목록
GET  /api/v1/stocks/{ticker}/latest-price   최신 종가
GET  /api/v1/market/stats                   시장 전체 통계
GET  /api/v1/recent-searches                사용자 최근 검색 종목
POST /api/v1/recent-searches/{ticker}       최근 검색 추가
DEL  /api/v1/recent-searches/{ticker}       최근 검색 단건 삭제
DEL  /api/v1/recent-searches                최근 검색 전체 삭제
POST /api/v1/stocks/{ticker}/ai             AI 종목 분석
"""

import os
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.supabase import supabase_admin
from app.dependencies import get_current_user
from app.core.security import TokenData

router = APIRouter(tags=["stocks"])


# ══════════════════════════════════════════════════════════════════
# 공통 유틸
# ══════════════════════════════════════════════════════════════════

def _safe_float(v, default=None):
    try:    return float(v)
    except: return default


def _nan_to_none(obj):
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _nan_to_none(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_nan_to_none(i) for i in obj]
    return obj


def _df_to_records(df: pd.DataFrame) -> list:
    return _nan_to_none(df.where(pd.notna(df), None).to_dict("records"))


def _get_grade(score: float) -> tuple[str, str]:
    if score >= 80: return "우수", "#22c55e"
    if score >= 65: return "양호", "#3b82f6"
    if score >= 45: return "보통", "#eab308"
    if score >= 25: return "주의", "#f97316"
    return "위험", "#ef4444"


# ── 기술지표 계산 ──────────────────────────────────────────────────

def _add_technicals(df: pd.DataFrame) -> pd.DataFrame:
    """price df는 반드시 date, close 컬럼으로 rename된 상태로 전달."""
    df = df.copy().sort_values("date").reset_index(drop=True)
    if df.empty:
        return df
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df["ma5"]   = df["close"].rolling(5).mean()
    df["ma20"]  = df["close"].rolling(20).mean()
    df["ma60"]  = df["close"].rolling(60).mean()
    std20 = df["close"].rolling(20).std()
    df["bb_upper"] = df["ma20"] + 2 * std20
    df["bb_lower"] = df["ma20"] - 2 * std20
    delta    = df["close"].diff()
    gain     = delta.clip(lower=0)
    loss     = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/14, min_periods=14, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["macd"]        = ema12 - ema26
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
    df["macd_hist"]   = df["macd"] - df["macd_signal"]
    return df


# ── 연간 재무 집계 ─────────────────────────────────────────────────

def _build_annual(fin_df: pd.DataFrame) -> pd.DataFrame:
    """
    ✅ 수정: year → fiscal_year, net_profit → net_income
             total_equity/assets/liabilities 제거 (Supabase에 없음)
    """
    if fin_df.empty:
        return pd.DataFrame()
    tmp = fin_df.copy()
    for col in ["revenue", "operating_profit", "net_income", "debt_ratio", "roe"]:
        if col in tmp.columns:
            tmp[col] = pd.to_numeric(tmp[col], errors="coerce")

    # ✅ groupby fiscal_year
    annual = tmp.groupby("fiscal_year", as_index=False).agg(
        revenue=("revenue", "sum"),
        operating_profit=("operating_profit", "sum"),
        net_income=("net_income", "sum"),        # ✅ net_profit → net_income
        debt_ratio=("debt_ratio", "last"),
        roe=("roe", "last"),
    )
    annual["year_num"] = pd.to_numeric(annual["fiscal_year"], errors="coerce")
    return annual.sort_values("year_num").reset_index(drop=True)


# ── 안전점수 계산 ──────────────────────────────────────────────────

def _calculate_score(fin_df: pd.DataFrame, price_df: pd.DataFrame, warn_df: pd.DataFrame) -> dict:
    """
    ✅ 수정:
       - total_equity 제거 → capital_impairment 컬럼으로 자본건전성 판단
       - net_profit → net_income
    """
    notes = []
    capital_score = debt_score = profit_score = 12.0
    volume_score = revenue_score = 6.0
    annual = _build_annual(fin_df)
    latest = fin_df.iloc[-1] if not fin_df.empty else None

    # ✅ 자본건전성: total_equity 없으므로 capital_impairment로 대체
    if latest is not None and "capital_impairment" in fin_df.columns:
        ci = latest.get("capital_impairment")
        if ci is not None:
            capital_score = 0.0 if bool(ci) else 25.0
        else:
            notes.append("자본건전성: 데이터 부족 → 중립 12점")
    else:
        notes.append("자본건전성: 데이터 부족 → 중립 12점")

    # 부채안정성
    if latest is not None and "debt_ratio" in fin_df.columns:
        dr = _safe_float(latest.get("debt_ratio"))
        if dr is not None:
            debt_score = (20.0 if dr < 100 else 16.0 if dr < 200 else
                          10.0 if dr < 400 else  5.0 if dr < 500 else 0.0)
        else:
            notes.append("부채안정성: 데이터 부족 → 중립 10점")
    else:
        notes.append("부채안정성: 데이터 부족 → 중립 10점")

    # ✅ 수익성: net_profit → net_income
    if not annual.empty and "net_income" in annual.columns:
        last3 = annual.dropna(subset=["year_num"]).sort_values("year_num").tail(3)
        if len(last3):
            loss = int((pd.to_numeric(last3["net_income"], errors="coerce") < 0).sum())
            if len(last3) < 3:
                profit_score = 16.0 if loss == 0 else 12.0 if loss == 1 else 8.0 if loss == 2 else 0.0
                notes.append("수익성: 연도 부족 → 보수 점수 적용")
            else:
                profit_score = 25.0 if loss == 0 else 16.0 if loss == 1 else 8.0 if loss == 2 else 0.0
        else:
            notes.append("수익성: 데이터 부족 → 중립 12점")
    else:
        notes.append("수익성: 데이터 부족 → 중립 12점")

    # 거래활성도
    if not price_df.empty and "volume" in price_df.columns:
        avg20 = pd.to_numeric(
            price_df.sort_values("date").tail(20)["volume"], errors="coerce").mean()
        if pd.notna(avg20):
            volume_score = (15.0 if avg20 >= 100_000 else 12.0 if avg20 >= 10_000 else
                             6.0 if avg20 >= 1_000 else 0.0)
        else:
            notes.append("거래활성도: 데이터 부족 → 중립 6점")
    else:
        notes.append("거래활성도: 데이터 부족 → 중립 6점")

    # 매출규모
    if not annual.empty and "revenue" in annual.columns:
        rev = _safe_float(annual.iloc[-1]["revenue"])
        if rev is not None:
            revenue_score = (15.0 if rev >= 10_000_000_000_000 else
                             13.0 if rev >=  1_000_000_000_000 else
                             10.0 if rev >=    100_000_000_000 else
                              6.0 if rev >=     50_000_000_000 else 2.0)
        else:
            notes.append("매출규모: 데이터 부족 → 중립 6점")
    else:
        notes.append("매출규모: 데이터 부족 → 중립 6점")

    active = 0
    if not warn_df.empty and "is_active" in warn_df.columns:
        active = int((warn_df["is_active"] == True).sum())  # ✅ boolean 타입 대응
    deduction = min(active * 8, 30)
    raw   = capital_score + debt_score + profit_score + volume_score + revenue_score
    final = max(0.0, min(100.0, raw - deduction))
    grade, grade_color = _get_grade(final)
    return _nan_to_none({
        "capital_score": capital_score, "debt_score": debt_score,
        "profit_score": profit_score,   "volume_score": volume_score,
        "revenue_score": revenue_score, "raw_score": raw,
        "deduction": deduction,         "active_warning_count": active,
        "final_score": final,           "grade": grade,
        "grade_color": grade_color,     "notes": notes,
    })


# ── Supabase 헬퍼 ─────────────────────────────────────────────────

def _fetch_financials(ticker: str) -> pd.DataFrame:
    """
    ✅ 수정: year → fiscal_year, quarter → fiscal_quarter
    """
    res = (
        supabase_admin.table("stock_financials")
        .select("*")
        .eq("ticker", ticker)
        .execute()
    )
    if not res.data:
        return pd.DataFrame()
    df = pd.DataFrame(res.data)
    # ✅ fiscal_year / fiscal_quarter 기준 정렬
    df["year_num"]    = pd.to_numeric(df["fiscal_year"], errors="coerce")
    df["quarter_num"] = df["fiscal_quarter"].map(
        {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4, "A": 5}
    ).fillna(0)
    return df.sort_values(["year_num", "quarter_num"]).reset_index(drop=True)


def _fetch_prices(ticker: str, limit: int = 2000) -> pd.DataFrame:
    """
    ✅ 수정: trade_date→date, open_price→open, high_price→high,
             low_price→low, close_price→close 로 rename
    """
    res = (
        supabase_admin.table("stock_prices")
        .select("ticker,trade_date,open_price,high_price,low_price,close_price,volume")
        .eq("ticker", ticker)
        .order("trade_date")
        .limit(limit)
        .execute()
    )
    if not res.data:
        return pd.DataFrame()
    df = pd.DataFrame(res.data)
    # ✅ 기술지표 계산 함수와 컬럼명 통일
    df = df.rename(columns={
        "trade_date"  : "date",
        "open_price"  : "open",
        "high_price"  : "high",
        "low_price"   : "low",
        "close_price" : "close",
    })
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def _fetch_warnings(ticker: str) -> pd.DataFrame:
    res = (
        supabase_admin.table("stock_warnings")
        .select("*")
        .eq("ticker", ticker)
        .execute()
    )
    return pd.DataFrame(res.data) if res.data else pd.DataFrame()


# ══════════════════════════════════════════════════════════════════
# 엔드포인트
# ══════════════════════════════════════════════════════════════════

# ── 시장 통계 ─────────────────────────────────────────────────────
@router.get("/api/v1/market/stats", summary="시장 전체 통계")
async def market_stats(_: TokenData = Depends(get_current_user)):
    try:
        stocks_res   = supabase_admin.table("stocks").select("ticker,market").execute()
        warnings_res = supabase_admin.table("stock_warnings").select("is_active").execute()
        stocks_data  = stocks_res.data or []
        warn_data    = warnings_res.data or []
        kospi  = sum(1 for s in stocks_data if s.get("market") == "KOSPI")
        kosdaq = sum(1 for s in stocks_data if s.get("market") == "KOSDAQ")
        # ✅ boolean True 대응
        active = sum(1 for w in warn_data if w.get("is_active") is True)
        return {
            "total_stocks":    len(stocks_data),
            "kospi_count":     kospi,
            "kosdaq_count":    kosdaq,
            "active_warnings": active,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 전체 종목 목록 ────────────────────────────────────────────────
@router.get("/api/v1/stocks", summary="전체 종목 목록")
async def list_stocks(_: TokenData = Depends(get_current_user)):
    try:
        res = (
            supabase_admin.table("stocks")
            .select("ticker,stock_name,market,sector,industry,listing_date")
            .order("ticker")
            .limit(5000)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 종목 기본정보 ─────────────────────────────────────────────────
@router.get("/api/v1/stocks/{ticker}", summary="종목 기본정보")
async def stock_info(ticker: str, _: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        res = (
            supabase_admin.table("stocks")
            .select("ticker,stock_name,market,sector,industry,listing_date")
            .eq("ticker", ticker)
            .maybe_single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="종목을 찾을 수 없습니다")
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 재무제표 ──────────────────────────────────────────────────────
@router.get("/api/v1/stocks/{ticker}/financials", summary="재무제표 (분기/연간)")
async def stock_financials(ticker: str, _: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        df = _fetch_financials(ticker)
        if df.empty:
            return {"quarterly": [], "annual": []}
        annual = _build_annual(df)
        return {
            "quarterly": _df_to_records(df),
            "annual":    _df_to_records(annual),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 가격 + 기술지표 ───────────────────────────────────────────────
@router.get("/api/v1/stocks/{ticker}/prices", summary="가격 + 기술지표")
async def stock_prices(ticker: str, _: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        df = _fetch_prices(ticker)
        if df.empty:
            return []
        tech = _add_technicals(df)
        cols = ["date", "open", "high", "low", "close", "volume",
                "ma5", "ma20", "ma60", "bb_upper", "bb_lower",
                "rsi", "macd", "macd_signal", "macd_hist"]
        return _df_to_records(tech[cols])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 위험 경고 ─────────────────────────────────────────────────────
@router.get("/api/v1/stocks/{ticker}/warnings", summary="위험 경고 목록")
async def stock_warnings(ticker: str, _: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        df = _fetch_warnings(ticker)
        return _df_to_records(df) if not df.empty else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 안전점수 ──────────────────────────────────────────────────────
@router.get("/api/v1/stocks/{ticker}/score", summary="안전점수 (0~100점)")
async def stock_score(ticker: str, _: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        fin_df   = _fetch_financials(ticker)
        price_df = _fetch_prices(ticker)
        warn_df  = _fetch_warnings(ticker)
        if not price_df.empty:
            price_df["date"] = pd.to_datetime(price_df["date"], errors="coerce")
        return _calculate_score(fin_df, price_df, warn_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 최신 종가 ─────────────────────────────────────────────────────
@router.get("/api/v1/stocks/{ticker}/latest-price", summary="최신 종가")
async def latest_price(ticker: str, _: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        res = (
            supabase_admin.table("stock_prices")
            .select("trade_date,close_price")   # ✅ 수정
            .eq("ticker", ticker)
            .order("trade_date", desc=True)     # ✅ 수정
            .limit(2)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return {"close": None, "prev_close": None, "date": None}
        close      = _safe_float(rows[0].get("close_price"))       # ✅ 수정
        prev_close = _safe_float(rows[1].get("close_price")) if len(rows) >= 2 else None  # ✅ 수정
        return {
            "close":      close,
            "prev_close": prev_close,
            "date":       rows[0].get("trade_date"),               # ✅ 수정
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════
# 최근 검색
# ══════════════════════════════════════════════════════════════════

@router.get("/api/v1/recent-searches", summary="최근 검색 종목 목록")
async def get_recent(current_user: TokenData = Depends(get_current_user)):
    try:
        # 최근 검색 ticker 목록 조회
        res = (
            supabase_admin.table("recent_searches")
            .select("ticker, searched_at")
            .eq("user_id", current_user.user_id)
            .order("searched_at", desc=True)
            .limit(12)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return []

        tickers = [r["ticker"] for r in rows]

        # ✅ stocks 테이블에서 종목명 + 시장 조회
        stocks_res = (
            supabase_admin.table("stocks")
            .select("ticker, stock_name, market")
            .in_("ticker", tickers)
            .execute()
        )
        # ticker → {stock_name, market} 매핑
        stock_map = {
            s["ticker"]: {
                "stock_name": s.get("stock_name", ""),
                "market":     s.get("market", ""),
            }
            for s in (stocks_res.data or [])
        }

        # ✅ 최근 검색 순서 유지하며 종목명 합쳐서 반환
        return [
            {
                "ticker":     r["ticker"],
                "stock_name": stock_map.get(r["ticker"], {}).get("stock_name", r["ticker"]),
                "market":     stock_map.get(r["ticker"], {}).get("market", ""),
            }
            for r in rows
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/v1/recent-searches/{ticker}", summary="최근 검색 추가")
async def add_recent(ticker: str, current_user: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        supabase_admin.table("recent_searches").upsert(
            {
                "user_id":     current_user.user_id,
                "ticker":      ticker,
                "searched_at": datetime.now(tz=timezone.utc).isoformat(),
            },
            on_conflict="user_id,ticker",
        ).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/v1/recent-searches/{ticker}", summary="최근 검색 단건 삭제")
async def delete_recent(ticker: str, current_user: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        supabase_admin.table("recent_searches").delete().eq(
            "user_id", current_user.user_id
        ).eq("ticker", ticker).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/v1/recent-searches", summary="최근 검색 전체 삭제")
async def clear_recent(current_user: TokenData = Depends(get_current_user)):
    try:
        supabase_admin.table("recent_searches").delete().eq(
            "user_id", current_user.user_id
        ).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════
# AI 분석
# ══════════════════════════════════════════════════════════════════

@router.post("/api/v1/stocks/{ticker}/ai", summary="AI 종목 안전성 분석")
async def ai_analysis(ticker: str, current_user: TokenData = Depends(get_current_user)):
    ticker = ticker.zfill(6)
    try:
        stock_res = (
            supabase_admin.table("stocks")
            .select("stock_name,market,sector")
            .eq("ticker", ticker)
            .maybe_single()
            .execute()
        )
        stock = stock_res.data or {}

        fin_df   = _fetch_financials(ticker)
        price_df = _fetch_prices(ticker)
        warn_df  = _fetch_warnings(ticker)
        score    = _calculate_score(fin_df, price_df, warn_df)

        annual = _build_annual(fin_df)
        latest = annual.iloc[-1].to_dict() if not annual.empty else {}

        stock_name = stock.get("stock_name", ticker)
        grade      = score["grade"]
        final_s    = score["final_score"]
        warns      = [
            w.get("warning_type", "")
            for w in _df_to_records(warn_df)
            if w.get("is_active") is True  # ✅ boolean 대응
        ]

        prompt = f"""다음은 한국 주식 종목 '{stock_name}({ticker})'의 재무 안전성 분석 결과입니다.

안전점수: {final_s:.0f}점 / 100점 (등급: {grade})
- 자본건전성: {score['capital_score']:.0f}/25점
- 부채안정성: {score['debt_score']:.0f}/20점
- 수익성: {score['profit_score']:.0f}/25점
- 거래활성도: {score['volume_score']:.0f}/15점
- 매출규모: {score['revenue_score']:.0f}/15점
- 활성 경고 수: {score['active_warning_count']}건
- 감점: -{score['deduction']:.0f}점

최근 재무 데이터 (연간):
- 매출액: {latest.get('revenue', '데이터없음')}원
- 영업이익: {latest.get('operating_profit', '데이터없음')}원
- 순이익: {latest.get('net_income', '데이터없음')}원
- 부채비율: {latest.get('debt_ratio', '데이터없음')}%
- ROE: {latest.get('roe', '데이터없음')}%

위험 경고: {', '.join(warns) if warns else '없음'}

위 데이터를 바탕으로 초보 투자자가 이해할 수 있도록:
1. 이 종목의 현재 재무 상태를 쉽게 요약해 주세요.
2. 주요 위험 요소가 있다면 구체적으로 설명해 주세요.
3. 투자 시 반드시 확인해야 할 사항을 알려주세요.

반드시 '이것은 투자 추천이 아니며 참고용 분석입니다.'라는 문구로 마무리해 주세요."""

        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.5,
        )
        return {"result": response.choices[0].message.content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 분석 실패: {str(e)}")
