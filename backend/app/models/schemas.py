"""
app/models/schemas.py
──────────────────────
Pydantic v2 공용 요청/응답 스키마.

네이밍 규칙:
  - 요청(Request Body) : XxxRequest
  - 응답(Response)     : XxxResponse
  - 내부 도메인 모델   : Xxx (접미사 없음)
"""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


# ── 공통 ──────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    env: str
    timestamp: datetime


class ErrorResponse(BaseModel):
    detail: str


# ── Auth ──────────────────────────────────────────────────────────────────────

class AuthVerifyResponse(BaseModel):
    user_id: str
    email: str
    role: str


# ── Market (시세) ─────────────────────────────────────────────────────────────

class QuoteResponse(BaseModel):
    symbol: str               # 종목코드 (예: 005930)
    name: str                 # 종목명
    current_price: int        # 현재가 (원)
    change: int               # 전일 대비 (원)
    change_rate: float        # 등락률 (%)
    volume: int               # 거래량
    market_cap: int | None    # 시가총액 (원)
    fetched_at: datetime


# ── Order (주문) ──────────────────────────────────────────────────────────────

class OrderRequest(BaseModel):
    symbol: str           = Field(..., description="종목코드 (예: 005930)")
    order_type: str       = Field(..., description="buy | sell")
    quantity: int         = Field(..., gt=0, description="주문 수량")
    price: int | None     = Field(None, description="지정가 (None=시장가)")


class OrderResponse(BaseModel):
    order_id: str
    symbol: str
    order_type: str
    quantity: int
    price: int | None
    status: str               # accepted | mock_accepted | rejected
    message: str
    ordered_at: datetime


# ── AI Chat ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str         = Field(..., min_length=1, max_length=1000)
    session_id: str | None = Field(None, description="대화 세션 ID (선택)")


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    sources: list[str]    = Field(default_factory=list, description="참조된 지식 출처")
    source_url: str | None = Field(None, description="외부 링크 버튼용 URL")
    answered_at: datetime


# ── Watchlist (관심종목) ───────────────────────────────────────────────────────

class WatchlistItem(BaseModel):
    stock_code: str
    stock_name: str | None = None
    created_at: datetime


class WatchlistRequest(BaseModel):
    stock_code: str   = Field(..., min_length=6, max_length=6, description="6자리 종목코드")
    stock_name: str   = Field(..., description="종목명")


# ── Account (계좌) ────────────────────────────────────────────────────────────

class AccountBalanceResponse(BaseModel):
    deposit:           int   # 예수금 (원)
    available:         int   # 매수가능금액 (원)
    total_eval:        int   # 보유종목 평가금액 (원)
    total_profit_loss: int   # 총손익 (원)


class HoldingItem(BaseModel):
    stock_code:       str
    stock_name:       str
    quantity:         int
    avg_price:        int     # 평균매수가 (원)
    current_price:    int     # 현재가 (원)
    profit_loss:      int     # 평가손익 (원)
    profit_loss_rate: float   # 수익률 (%)


# ── Portfolio ─────────────────────────────────────────────────────────────────

class PortfolioAnalysisResponse(BaseModel):
    user_id: str
    total_value: int              # 총 평가금액 (원)
    profit_loss: int              # 총 손익 (원)
    profit_loss_rate: float       # 총 수익률 (%)
    diversification_score: float  # 분산도 점수 (0~100)
    risk_level: str               # conservative | moderate | aggressive
    suggestions: list[str]        = Field(default_factory=list)
    analyzed_at: datetime
