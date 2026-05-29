"""
tests/test_kis_cache.py
────────────────────────
kis_client 의 Fresh response cache (TTL 5초) 동작 검증.

[검증]
  1) _fresh_put 직후 _fresh_get 으로 동일 값 회수
  2) TTL 만료 시 None 반환
  3) place_order 성공 시 _fresh_invalidate_user 가 잔고/보유 캐시만 정리
"""

import time
from app.services import kis_client


def setup_function(_):
    """각 테스트 시작 시 _FRESH_CACHE 초기화."""
    kis_client._FRESH_CACHE.clear()


def test_fresh_put_and_get_returns_value():
    kis_client._fresh_put(("quote", "005930"), {"price": 70000})
    assert kis_client._fresh_get(("quote", "005930")) == {"price": 70000}


def test_fresh_get_returns_none_after_ttl():
    # TTL 을 0.01 초로 임시 단축
    original_ttl = kis_client._FRESH_TTL_SEC
    try:
        kis_client._FRESH_TTL_SEC = 0.01
        kis_client._fresh_put(("quote", "005930"), {"price": 70000})
        time.sleep(0.02)
        assert kis_client._fresh_get(("quote", "005930")) is None
    finally:
        kis_client._FRESH_TTL_SEC = original_ttl


def test_fresh_get_returns_none_for_missing_key():
    assert kis_client._fresh_get(("quote", "999999")) is None


def test_invalidate_user_clears_balance_and_holdings_only():
    uid, mock = "u-1", True
    # 사용자별 캐시
    kis_client._fresh_put(("balance",  uid, mock), {"deposit": 1_000_000})
    kis_client._fresh_put(("holdings", uid, mock), [{"stock_code": "005930"}])
    # 같은 사용자가 본 종목 시세 (무효화 대상 아님 — 시세는 사용자 비종속)
    kis_client._fresh_put(("quote", "005930"), {"price": 70000})

    kis_client._fresh_invalidate_user(uid, mock)

    assert kis_client._fresh_get(("balance",  uid, mock)) is None
    assert kis_client._fresh_get(("holdings", uid, mock)) is None
    # 시세 캐시는 보존
    assert kis_client._fresh_get(("quote", "005930")) == {"price": 70000}


def test_invalidate_user_does_not_touch_other_users():
    kis_client._fresh_put(("balance", "u-1", True), {"deposit": 1})
    kis_client._fresh_put(("balance", "u-2", True), {"deposit": 2})

    kis_client._fresh_invalidate_user("u-1", True)

    assert kis_client._fresh_get(("balance", "u-1", True)) is None
    assert kis_client._fresh_get(("balance", "u-2", True)) == {"deposit": 2}
