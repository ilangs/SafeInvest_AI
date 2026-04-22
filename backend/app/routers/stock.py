"""
app/routers/stock.py
─────────────────────
종목 기초분석 엔드포인트.

GET /api/v1/stock/{code}/overview     기업 개요 + 투자지표
GET /api/v1/stock/{code}/financials   재무제표 (연간 최근 2개년)
GET /api/v1/stock/{code}/peers        동종업종 비교 (같은 sector, 시가총액 상위 5)
GET /api/v1/stock/{code}/risk         위험신호 목록
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.core.security import TokenData
from app.core.supabase import supabase_admin
from app.models.schemas import (
    StockOverview,
    FinancialSummary,
    PeerCompany,
    RiskFlag,
)

router = APIRouter(prefix="/api/v1/stock", tags=["stock"])


def _get_company_or_404(code: str) -> dict:
    res = (
        supabase_admin.table("stock_companies")
        .select("*")
        .eq("stock_code", code)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"종목 {code}을(를) 찾을 수 없습니다.")
    return res.data


@router.get("/{code}/overview", response_model=StockOverview, summary="기업 개요 + 투자지표")
async def get_overview(code: str, _: TokenData = Depends(get_current_user)):
    company = _get_company_or_404(code)

    risk_res = (
        supabase_admin.table("risk_flags")
        .select("id", count="exact")
        .eq("stock_code", code)
        .eq("is_active", True)
        .execute()
    )
    risk_count = risk_res.count or 0

    return StockOverview(
        stock_code=company["stock_code"],
        stock_name=company["stock_name"],
        market=company.get("market"),
        sector=company.get("sector"),
        business_summary=company.get("business_summary"),
        per=company.get("per"),
        pbr=company.get("pbr"),
        div_yield=company.get("div_yield"),
        market_cap=company.get("market_cap"),
        risk_count=risk_count,
    )


@router.get("/{code}/financials", response_model=list[FinancialSummary], summary="재무제표 (연간 최근 2개년)")
async def get_financials(code: str, _: TokenData = Depends(get_current_user)):
    _get_company_or_404(code)

    res = (
        supabase_admin.table("financial_statements")
        .select(
            "fiscal_year, report_type, revenue, operating_profit, "
            "net_income, debt_ratio, roe, operating_margin"
        )
        .eq("stock_code", code)
        .eq("report_type", "annual")
        .order("fiscal_year", desc=True)
        .limit(2)
        .execute()
    )
    return res.data


@router.get("/{code}/peers", response_model=list[PeerCompany], summary="동종업종 비교 (시가총액 상위 5)")
async def get_peers(code: str, _: TokenData = Depends(get_current_user)):
    company = _get_company_or_404(code)
    sector = company.get("sector")

    if not sector:
        return []

    res = (
        supabase_admin.table("stock_companies")
        .select("stock_code, stock_name, per, pbr, market_cap")
        .eq("sector", sector)
        .order("market_cap", desc=True)
        .limit(5)
        .execute()
    )

    return [
        PeerCompany(
            stock_code=row["stock_code"],
            stock_name=row["stock_name"],
            per=row.get("per"),
            pbr=row.get("pbr"),
            market_cap=row.get("market_cap"),
            is_selected=(row["stock_code"] == code),
        )
        for row in res.data
    ]


@router.get("/{code}/risk", response_model=list[RiskFlag], summary="위험신호 목록")
async def get_risk(code: str, _: TokenData = Depends(get_current_user)):
    _get_company_or_404(code)

    res = (
        supabase_admin.table("risk_flags")
        .select("flag_type, severity, flag_detail")
        .eq("stock_code", code)
        .eq("is_active", True)
        .order("severity")
        .execute()
    )
    return res.data
