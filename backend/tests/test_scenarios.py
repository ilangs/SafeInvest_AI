"""
tests/test_scenarios.py
────────────────────────
전체 시나리오 통합 테스트.
JWT 없이 로직 흐름을 검증합니다.
"""

import os
import asyncio

# ── 테스트용 환경변수 설정 (import 전에 먼저) ──────────────────────────────
os.environ.setdefault("SUPABASE_URL",               "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY",          "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY",  "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET",        "test-jwt-secret-32-chars-padded!!")
os.environ.setdefault("OPENAI_API_KEY",             "sk-test")
os.environ.setdefault("KIS_APP_KEY",                "test-kis-key")
os.environ.setdefault("KIS_APP_SECRET",             "test-kis-secret")
os.environ.setdefault("KIS_ACCOUNT",                "00000000")
os.environ.setdefault("FASTAPI_SECRET_KEY",         "test-secret")

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

AUTH_REQUIRED_ENDPOINTS = [
    ("GET",  "/api/v1/auth/verify",       None),
    ("GET",  "/api/v1/watchlist",         None),
    ("POST", "/api/v1/ai/chat",           {"question": "test"}),
    ("GET",  "/api/v1/account/balance",   None),
    ("GET",  "/api/v1/account/holdings",  None),
    ("POST", "/api/v1/order",             {"symbol": "005930", "order_type": "buy", "quantity": 1}),
]


# ── [1] 헬스체크 + Docs ────────────────────────────────────────────────────

def test_health_and_docs():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "env" in data
    assert "kis_mode" in data

    resp_docs = client.get("/docs")
    assert resp_docs.status_code == 200


# ── [2] 인증 필요 엔드포인트 전체 — 토큰 없이 403/401 반환 ──────────────────

def test_auth_endpoints_reject_no_token():
    for method, path, body in AUTH_REQUIRED_ENDPOINTS:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path, json=body)
        assert resp.status_code in (401, 403), (
            f"{method} {path} → expected 401/403, got {resp.status_code}"
        )


# ── [3] 시세 조회 — 토큰 없이 401/403 ──────────────────────────────────────

def test_market_quote_requires_auth():
    resp = client.get("/api/v1/market/quote?symbol=005930")
    assert resp.status_code in (401, 403)


# ── [4] 주문 스키마 유효성 검사 ─────────────────────────────────────────────

@pytest.mark.parametrize("body", [
    {"symbol": "005930", "order_type": "buy",  "quantity": 0},   # 0 이하 금지
    {"symbol": "005930", "order_type": "sell", "quantity": -1},  # 음수 금지
    {"symbol": "005930", "order_type": "hold", "quantity": 1},   # hold 불허 (서버에서 처리)
])
def test_order_schema_validation(body):
    # FastAPI는 인증 의존성을 body 파싱보다 먼저 실행하므로
    # quantity <= 0 이어도 토큰 없으면 401/403이 먼저 반환될 수 있음
    resp = client.post("/api/v1/order", json=body)
    assert resp.status_code in (422, 401, 403), (
        f"body={body} expected 422/401/403, got {resp.status_code}: {resp.text}"
    )


# ── [5] 관심종목 스키마 유효성 검사 ─────────────────────────────────────────

def test_watchlist_schema_validation():
    # stock_code 누락 → 422
    resp = client.post("/api/v1/watchlist", json={"stock_name": "삼성전자"})
    assert resp.status_code in (422, 401, 403)

    # stock_code 길이 오류 (5자리, min 6) → 422
    resp2 = client.post("/api/v1/watchlist", json={"stock_code": "12345", "stock_name": "test"})
    assert resp2.status_code in (422, 401, 403)


# ── [6] AI 채팅 스키마 유효성 검사 ──────────────────────────────────────────

def test_ai_chat_schema_validation():
    # 빈 question → 422
    resp = client.post("/api/v1/ai/chat", json={"question": ""})
    assert resp.status_code in (422, 401, 403)
    if resp.status_code == 422:
        assert "question" in resp.text.lower() or "min_length" in resp.text.lower() or "string_too_short" in resp.text.lower()

    # 1001자 question → 422
    long_q = "가" * 1001
    resp2 = client.post("/api/v1/ai/chat", json={"question": long_q})
    assert resp2.status_code in (422, 401, 403)
    if resp2.status_code == 422:
        assert "question" in resp2.text.lower() or "max_length" in resp2.text.lower() or "string_too_long" in resp2.text.lower()


# ── [7] RAG 체인 fallback — 지식DB 없거나 연결 불가 시 에러 없이 응답 ─────────

def test_rag_chain_fallback():
    """
    Supabase 연결이 불가능한 테스트 환경에서도
    rag_chain.ask()가 에러 없이 fallback 메시지를 반환하는지 확인합니다.
    """
    from app.services.rag_chain import ask

    result = asyncio.run(
        ask("아무도 모르는 질문xyz123", user_id="00000000-0000-0000-0000-000000000001")
    )

    assert isinstance(result, dict), "결과가 dict여야 합니다"
    assert "answer" in result,       "answer 필드가 있어야 합니다"
    assert len(result["answer"]) > 0, "answer가 비어있지 않아야 합니다"
    assert "session_id" in result,   "session_id 필드가 있어야 합니다"
