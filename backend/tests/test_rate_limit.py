"""
tests/test_rate_limit.py
─────────────────────────
rate_limit 미들웨어 단위 테스트.

[검증]
  1) RPC 가 한도 초과(used >= limit) 를 반환하면 429 발생
  2) RPC 호출 실패 시 fail-open (예외 전파 X, 통과)
  3) 정상 사용 중일 때 통과 + 반환 dict 검증
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.core import rate_limit
from app.core.security import TokenData


def _user(uid: str = "u-1") -> TokenData:
    # exp = 멀리 미래 (검증 우회 — verify_jwt 가 아닌 직접 생성)
    return TokenData({
        "sub":   uid,
        "email": "t@t.com",
        "role":  "authenticated",
        "exp":   9999999999,
    })


def _rpc_return(used: int, limit: int, tokens_used: int = 0, token_limit: int = 50_000):
    resp = MagicMock()
    resp.data = [{
        "used": used, "daily_limit": limit, "remaining": max(0, limit - used),
        "tokens_used": tokens_used, "token_limit": token_limit,
        "token_remaining": max(0, token_limit - tokens_used),
    }]
    return resp


def _cost_rpc(cost_used: float, cost_limit: float = 5.00):
    resp = MagicMock()
    resp.data = [{
        "cost_used": cost_used, "cost_limit": cost_limit,
        "cost_remaining": max(0.0, cost_limit - cost_used),
        "tokens_used": 0, "call_count": 0,
    }]
    return resp


# ── check_chat_quota ────────────────────────────────────────────────────────

def test_chat_quota_passes_when_under_limit():
    with patch.object(rate_limit.supabase_admin, "rpc") as rpc:
        rpc.return_value.execute.return_value = _rpc_return(used=10, limit=50)
        import asyncio
        result = asyncio.new_event_loop().run_until_complete(
            rate_limit.check_chat_quota(current_user=_user())
        )
    assert result["remaining"] == 40
    assert result["used"] == 10


def test_chat_quota_raises_429_when_at_limit():
    with patch.object(rate_limit.supabase_admin, "rpc") as rpc:
        rpc.return_value.execute.return_value = _rpc_return(used=50, limit=50)
        import asyncio
        with pytest.raises(HTTPException) as exc:
            asyncio.new_event_loop().run_until_complete(
                rate_limit.check_chat_quota(current_user=_user())
            )
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "chat_daily_limit_exceeded"


def test_chat_quota_fail_open_on_rpc_error():
    with patch.object(rate_limit.supabase_admin, "rpc",
                      side_effect=RuntimeError("supabase down")):
        import asyncio
        # 예외가 전파되지 않아야 함 (서비스 가용성 우선)
        result = asyncio.get_event_loop().run_until_complete(
            rate_limit.check_chat_quota(current_user=_user())
        )
    assert result["remaining"] == 999  # fail-open sentinel


# ── check_order_quota ───────────────────────────────────────────────────────

def test_order_quota_raises_429_when_over_limit():
    with patch.object(rate_limit.supabase_admin, "rpc") as rpc:
        rpc.return_value.execute.return_value = _rpc_return(used=20, limit=20)
        import asyncio
        with pytest.raises(HTTPException) as exc:
            asyncio.new_event_loop().run_until_complete(
                rate_limit.check_order_quota(current_user=_user())
            )
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "order_daily_limit_exceeded"
    assert exc.value.headers["X-RateLimit-Remaining"] == "0"


# ── P1-b : 토큰 한도 ────────────────────────────────────────────────────────

def test_chat_quota_raises_when_token_limit_exceeded():
    """횟수는 여유롭지만 토큰량이 한도 도달 → 429 tokens 코드"""
    with patch.object(rate_limit.supabase_admin, "rpc") as rpc:
        rpc.return_value.execute.return_value = _rpc_return(
            used=5, limit=50, tokens_used=50_000, token_limit=50_000,
        )
        import asyncio
        with pytest.raises(HTTPException) as exc:
            asyncio.new_event_loop().run_until_complete(
                rate_limit.check_chat_quota(current_user=_user())
            )
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "tokens_daily_limit_exceeded"


# ── P1-c : 시스템 Circuit Breaker ───────────────────────────────────────────

def test_breaker_passes_below_cost_limit():
    with patch.object(rate_limit.supabase_admin, "rpc") as rpc:
        rpc.return_value.execute.return_value = _cost_rpc(cost_used=1.20)
        import asyncio
        result = asyncio.new_event_loop().run_until_complete(
            rate_limit.check_system_cost_breaker()
        )
    assert result["cost_used"] == 1.20
    assert result["cost_remaining"] == pytest.approx(3.80)


def test_breaker_raises_503_at_cost_limit():
    with patch.object(rate_limit.supabase_admin, "rpc") as rpc:
        rpc.return_value.execute.return_value = _cost_rpc(cost_used=5.01)
        import asyncio
        with pytest.raises(HTTPException) as exc:
            asyncio.new_event_loop().run_until_complete(
                rate_limit.check_system_cost_breaker()
            )
    assert exc.value.status_code == 503
    assert exc.value.detail["code"] == "system_cost_breaker_open"
    assert exc.value.headers["Retry-After"] == "3600"


def test_breaker_fail_open_on_rpc_error():
    with patch.object(rate_limit.supabase_admin, "rpc",
                      side_effect=RuntimeError("supabase down")):
        import asyncio
        # 비용 RPC 실패 시 서비스 차단 X (가용성 우선)
        result = asyncio.new_event_loop().run_until_complete(
            rate_limit.check_system_cost_breaker()
        )
    assert result["cost_used"] == 0.0
