"""
main.py
────────
FastAPI 앱 진입점 및 오케스트레이션 허브.

실행:
  개발  : uvicorn main:app --reload --port 8000
  운영  : gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker

Render.com 배포 시 Start Command:
  uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import auth, market, order, orders, ai, watchlist, account, credentials, stocks
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

app = FastAPI(
    title="SafeInvest AI",
    description="건전 투자 가이드 AI 플랫폼 — Backend API",
    version="0.1.0",
    docs_url="/docs",          # Swagger UI (개발 환경)
    redoc_url="/redoc",        # ReDoc
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

# ── 교육 모듈 라우터 ───────────────────────────────────────────────────────────
app.include_router(education_router)
app.include_router(self_router)
app.include_router(curriculum_router)
app.include_router(fss_proxy_router)

# ── 정적 파일 (교육 영상) ──────────────────────────────────────────────────────
_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")


# ── 헬스체크 (UptimeRobot 대상) ───────────────────────────────────────────────

@app.get("/health", tags=["system"], summary="서버 상태 확인")
async def health_check():
    """
    UptimeRobot 이 10분마다 이 엔드포인트를 호출합니다.
    Render.com Free tier 의 Sleep 을 방지합니다.
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
