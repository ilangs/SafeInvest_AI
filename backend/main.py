"""
main.py — SafeInvest AI 백엔드의 시작점
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  FastAPI 앱을 만들고, 모든 라우터(엔드포인트)를 등록하고, CORS·정적파일·
  헬스체크까지 한 곳에서 조립하는 "조립 공장" 역할.

[처음 보는 분께]
  - SafeInvest AI는 ① 한국 주식 매매(KIS API) ② AI 투자 챗봇(LangGraph)
    ③ 시장분석 ④ 교육센터 ⑤ 학습기록 의 5대 모듈로 구성됩니다.
  - 각 모듈은 app/routers/*.py 에 분리되어 있고, 이 파일에서 통합됩니다.
  - 인증은 Supabase JWT를 사용 (app/core/security.py의 verify_jwt).
  - DB는 Supabase Postgres + pgvector(임베딩) + RLS(행 단위 보안).

[실행]
  개발 : uvicorn main:app --reload --port 8000
  운영 : Render.com 배포 (Procfile + render.yaml)

[URL]
  /docs            Swagger UI (모든 엔드포인트 인터랙티브 테스트)
  /health          서버 상태 (.github/workflows/keep_alive.yml 이 12분마다 호출 — Render Free tier 15분 idle sleep 방지)
  /api/v1/...      API 본체 (인증 필요한 엔드포인트 다수)
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import auth, market, order, orders, ai, watchlist, account, credentials, stocks, study_logs
from app.education.router import router as education_router, self_router
from app.education.curriculum import router as curriculum_router
from app.education.fss_proxy import router as fss_proxy_router


# ── Lifespan (시작/종료 훅) ────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 초기화 로직, 종료 시 정리 로직을 여기에 작성합니다."""
    print(f"[SafeInvest AI] 서버 시작 | env={settings.fastapi_env}")
    print(f"[SafeInvest AI] KIS: 사용자별 키 관리 모드 (user_kis_credentials)")
    yield
    print("[SafeInvest AI] 서버 종료")


# ── FastAPI 앱 생성 ────────────────────────────────────────────────────────────

_is_production = settings.fastapi_env == "production"

app = FastAPI(
    title="SafeInvest AI",
    description="건전 투자 가이드 AI 플랫폼 — Backend API",
    version="0.1.0",
    # production 환경에선 Swagger/ReDoc 비활성화 — 스키마 메모리 부담 ↓ + 보안 ↑
    docs_url=None if _is_production else "/docs",
    redoc_url=None,
    openapi_url=None if _is_production else "/openapi.json",
    lifespan=lifespan,
)


# ── CORS ───────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,   # .env 의 ALLOWED_ORIGINS 에서 파싱
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 라우터 등록 ────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(market.router)
app.include_router(order.router)
app.include_router(ai.router)
app.include_router(watchlist.router)
app.include_router(account.router)
app.include_router(stocks.router)
app.include_router(credentials.router)
app.include_router(orders.router)
app.include_router(study_logs.router)

# ── 교육 모듈 라우터 ───────────────────────────────────────────────────────────
app.include_router(education_router)
app.include_router(self_router)
app.include_router(curriculum_router)
app.include_router(fss_proxy_router)

# ── 정적 파일 (교육 영상) ──────────────────────────────────────────────────────
_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")


# ── 헬스체크 (GitHub Actions keep_alive.yml 워크플로우가 12분마다 호출) ─────

@app.get("/health", tags=["system"], summary="서버 상태 확인")
async def health_check():
    """
    GitHub Actions 워크플로우 `.github/workflows/keep_alive.yml` 이 12분마다
    이 엔드포인트를 호출하여 Render.com Free tier 의 15분 idle Sleep 을 방지합니다.
    (이전에 사용하던 UptimeRobot 은 중단)
    인증 불필요.
    """
    return JSONResponse({
        "status":    "ok",
        "env":       settings.fastapi_env,
        "kis_mode":  "user-managed",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    })


# ── 루트 ─────────────────────────────────────────────────────────────────────

@app.get("/", tags=["system"], include_in_schema=False)
async def root():
    return {"message": "SafeInvest AI API is running. See /docs for details."}
