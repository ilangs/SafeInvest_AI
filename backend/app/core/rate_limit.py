"""
app/core/rate_limit.py — 베타 사용자 일일 사용량 선제 검사
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  AI 챗 / 모의주문 엔드포인트 진입 직후, LLM·KIS 외부 호출을 시작하기 *전에*
  Supabase RPC (usage_today_chat / usage_today_orders) 로 오늘 사용량을 조회.
  한도 초과 시 HTTP 429 로 즉시 거부하여 외부 API 비용을 0 으로 만든다.

[3중 방어선에서의 위치]
  1) 이 미들웨어 (선제 차단)           ← 비용 방어, UX 친절한 메시지
  2) DB 트리거 (06_beta_safeguards.sql) ← API 우회 INSERT 차단
  3) Supabase RLS                        ← 타 유저 데이터 접근 차단

[한도 (DB RPC 와 동기화 필요)]
  - AI 챗 횟수    : 50/일       (usage_today_chat.daily_limit)
  - AI 챗 토큰    : 50,000/일   (usage_today_chat.token_limit)
  - 모의주문      : 20/일       (usage_today_orders.daily_limit)
  - 시스템 비용    : $5/일      (system_cost_today.cost_limit)
  ※ 변경 시 06_beta_safeguards.sql / 07_beta_safeguards_phase2.sql 함께 수정.

[사용 예]
    @router.post("/chat")
    async def chat(
        body: ChatRequest,
        current_user: TokenData = Depends(get_current_user),
        _breaker = Depends(check_system_cost_breaker),
        _quota   = Depends(check_chat_quota),
    ):
        ...
"""

from fastapi import Depends, HTTPException, status
from app.core.security import TokenData
from app.core.supabase import supabase_admin
from app.dependencies import get_current_user


# ── 한도 상수 (DB RPC 와 일치해야 함) ─────────────────────────────────────────

CHAT_DAILY_LIMIT  = 50
CHAT_TOKEN_LIMIT  = 50_000
ORDER_DAILY_LIMIT = 20
SYSTEM_COST_LIMIT_USD = 5.00


# ── 내부 유틸 ────────────────────────────────────────────────────────────────

def _fetch_usage(rpc_name: str, user_id: str) -> dict:
    """
    usage_today_chat / usage_today_orders RPC 호출.
    실패 시 0/0/limit 으로 fail-open (서비스 가용성 우선).

    usage_today_chat 은 토큰 필드(tokens_used / token_limit / token_remaining)
    도 함께 반환 — 없을 경우 기본 0/0/sentinel 로 처리.
    """
    try:
        resp = supabase_admin.rpc(rpc_name, {"p_user_id": user_id}).execute()
        rows = resp.data or []
        if rows:
            row = rows[0]
            return {
                "used":            int(row.get("used", 0)),
                "limit":           int(row.get("daily_limit", 0)),
                "remaining":       int(row.get("remaining", 0)),
                "tokens_used":     int(row.get("tokens_used", 0)),
                "token_limit":     int(row.get("token_limit", 0)),
                "token_remaining": int(row.get("token_remaining", 999_999)),
            }
    except Exception as exc:
        # 사용량 조회 실패는 서비스 차단 사유가 아님 — 로그만 남기고 통과
        print(f"[rate_limit] RPC {rpc_name} 조회 실패 (fail-open): {exc}")
    return {
        "used": 0, "limit": 0, "remaining": 999,
        "tokens_used": 0, "token_limit": 0, "token_remaining": 999_999,
    }


def _fetch_system_cost() -> dict:
    """system_cost_today RPC — 시스템 전체 일일 비용 누계."""
    try:
        resp = supabase_admin.rpc("system_cost_today", {}).execute()
        rows = resp.data or []
        if rows:
            row = rows[0]
            return {
                "cost_used":      float(row.get("cost_used", 0.0)),
                "cost_limit":     float(row.get("cost_limit", SYSTEM_COST_LIMIT_USD)),
                "cost_remaining": float(row.get("cost_remaining", SYSTEM_COST_LIMIT_USD)),
                "tokens_used":    int(row.get("tokens_used", 0)),
                "call_count":     int(row.get("call_count", 0)),
            }
    except Exception as exc:
        print(f"[rate_limit] system_cost_today 조회 실패 (fail-open): {exc}")
    return {
        "cost_used": 0.0, "cost_limit": SYSTEM_COST_LIMIT_USD,
        "cost_remaining": SYSTEM_COST_LIMIT_USD, "tokens_used": 0, "call_count": 0,
    }


def _raise_429(kind: str, used, limit) -> None:
    """한도 초과 시 사용자 친화 메시지로 429 응답."""
    msg_map = {
        "chat":   f"오늘 AI 질문 {limit}회를 모두 사용하셨어요. 내일 자정(KST)에 초기화됩니다.",
        "tokens": f"오늘 AI 사용량(토큰 {limit:,})을 모두 사용하셨어요. 내일 자정(KST)에 초기화됩니다.",
        "order":  f"오늘 모의주문 {limit}회를 모두 사용하셨어요. 내일 자정(KST)에 초기화됩니다.",
    }
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code":    f"{kind}_daily_limit_exceeded",
            "message": msg_map.get(kind, "일일 사용 한도를 초과했습니다."),
            "used":    used,
            "limit":   limit,
        },
        headers={
            "X-RateLimit-Limit":     str(limit),
            "X-RateLimit-Remaining": "0",
        },
    )


def _raise_503_breaker(cost_used: float, cost_limit: float) -> None:
    """시스템 일일 비용 한도 도달 — 모든 챗 요청 일시 차단."""
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code":       "system_cost_breaker_open",
            "message":    "현재 AI 상담 서비스 일일 운영 한도에 도달했습니다. "
                          "내일 자정(KST) 이후 다시 이용해 주세요.",
            "cost_used":  round(cost_used, 4),
            "cost_limit": round(cost_limit, 4),
        },
        headers={
            "Retry-After": "3600",  # 1시간 후 재시도 권장
        },
    )


# ── 의존성 함수 ──────────────────────────────────────────────────────────────

async def check_chat_quota(
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """
    AI 챗 일일 한도 검사 — 횟수 + 토큰 두 기준 모두 적용.
    어느 하나라도 초과하면 429. 통과 시 사용량 dict 반환.

    라우터에서 `_quota = Depends(check_chat_quota)` 형태로 주입.
    """
    usage = _fetch_usage("usage_today_chat", current_user.user_id)

    # 1) 횟수 한도
    if usage["limit"] and usage["used"] >= usage["limit"]:
        _raise_429("chat", usage["used"], usage["limit"])

    # 2) 토큰 한도 (도배 방지 — 짧은 질문 수십개보다 긴 질문 몇 개가 더 큰 부담)
    if usage["token_limit"] and usage["tokens_used"] >= usage["token_limit"]:
        _raise_429("tokens", usage["tokens_used"], usage["token_limit"])

    return usage


async def check_system_cost_breaker() -> dict:
    """
    시스템 전체 일일 비용 Circuit Breaker.
    오늘 누적 LLM 비용이 SYSTEM_COST_LIMIT_USD 이상이면 503 (모든 사용자 차단).

    [의도]
      - 사용자별 한도가 뚫린 최악의 경우(예: 100명이 동시에 50회씩)에도
        월 예산이 폭주하지 않도록 보호.
      - check_chat_quota 보다 먼저 평가되도록 라우터 의존성 순서 주의.
    """
    cost = _fetch_system_cost()
    if cost["cost_used"] >= cost["cost_limit"]:
        _raise_503_breaker(cost["cost_used"], cost["cost_limit"])
    return cost


async def check_order_quota(
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """
    모의주문 일일 한도 검사. 초과 시 429, 통과 시 사용량 dict 반환.
    """
    usage = _fetch_usage("usage_today_orders", current_user.user_id)
    if usage["limit"] and usage["used"] >= usage["limit"]:
        _raise_429("order", usage["used"], usage["limit"])
    return usage
