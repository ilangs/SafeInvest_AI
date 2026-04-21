"""
app/routers/portfolio.py
─────────────────────────
포트폴리오 분석 엔드포인트.

GET /api/v1/portfolio/analysis   포트폴리오 분석 결과

TODO: Phase 2 에서 실제 보유 종목 조회 및 분산도 계산 로직 구현.
현재는 스텁(stub) 응답을 반환합니다.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import PortfolioAnalysisResponse

router = APIRouter(prefix="/api/v1/portfolio", tags=["portfolio"])


@router.get(
    "/analysis",
    response_model=PortfolioAnalysisResponse,
    summary="포트폴리오 분석",
)
async def get_portfolio_analysis(
    current_user: TokenData = Depends(get_current_user),
):
    """
    사용자의 보유 종목을 분석하여 분산도 및 위험도를 반환합니다.
    Phase 1: 스텁 응답 반환
    Phase 2: 실제 KIS API 잔고 조회 + AI 분석 연결
    """
    # Phase 1 스텁 ─ ② 담당이 Phase 2 에서 실제 로직으로 교체합니다.
    return PortfolioAnalysisResponse(
        user_id=current_user.user_id,
        total_value=0,
        profit_loss=0,
        profit_loss_rate=0.0,
        diversification_score=0.0,
        risk_level="moderate",
        suggestions=["포트폴리오 데이터가 없습니다. KIS 계좌를 연동해 주세요."],
        analyzed_at=datetime.now(tz=timezone.utc),
    )
