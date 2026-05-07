"""
scripts/seed_study_logs.py
───────────────────────────
StudyLogPage 의 mock 데이터 10건을 test@safeinvest.dev 계정으로
study_logs 테이블에 1회 삽입합니다.

실행:
  cd backend
  python scripts/seed_study_logs.py

동작:
  1. Supabase Auth 에서 test@safeinvest.dev 의 user_id 조회
  2. study_logs 테이블에 중복 체크 후 INSERT (이미 해당 user 의 기록이 있으면 중단)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin

TARGET_EMAIL = "test@safeinvest.dev"

MOCK_LOGS = [
    {
        "title":      "미국 금리 뉴스 흐름 정리",
        "log_date":   "2026-05-15",
        "mood":       "복습",
        "tag":        "경제뉴스",
        "content":    (
            "미국 기준금리 관련 뉴스가 시장 전체 분위기에 영향을 준다는 점을 다시 정리했습니다.\n"
            "금리 인상은 성장주에 부담이 될 수 있고, 환율과 외국인 수급에도 영향을 줄 수 있다는 내용을 복습했습니다."
        ),
        "ai_comment": "뉴스를 볼 때는 단순 기사보다 시장 반응까지 함께 확인해 보세요.",
    },
    {
        "title":      "손익비 개념 다시 정리",
        "log_date":   "2026-05-14",
        "mood":       "학습 완료",
        "tag":        "매매원칙",
        "content":    (
            "손실 대비 기대 수익 비율이 중요하다는 점을 복습했습니다.\n"
            "승률이 조금 낮더라도 손익비가 좋으면 장기적으로 유리할 수 있다는 개념을 다시 정리했습니다."
        ),
        "ai_comment": "매매 전 리스크와 기대 수익을 함께 계산하는 습관을 만들어 보세요.",
    },
    {
        "title":      "ETF와 개별 종목 차이 복습",
        "log_date":   "2026-05-13",
        "mood":       "학습 완료",
        "tag":        "ETF공부",
        "content":    (
            "ETF는 여러 종목을 한 번에 담는 상품이라 개별 종목보다 분산투자 효과가 있습니다.\n"
            "다만 ETF도 가격 변동이 있기 때문에 안정적이라고만 생각하면 안 된다는 점을 정리했습니다."
        ),
        "ai_comment": "ETF도 투자 상품이므로 구성 종목과 수수료를 함께 확인해 보세요.",
    },
    {
        "title":      "분산투자의 의미 다시 정리",
        "log_date":   "2026-05-12",
        "mood":       "복습",
        "tag":        "투자원칙",
        "content":    (
            "한 종목에만 집중하면 위험이 커질 수 있습니다.\n"
            "업종, 자산, 시점을 나누어 투자하면 손실 위험을 줄일 수 있다는 점을 복습했습니다."
        ),
        "ai_comment": "분산투자는 수익을 보장하는 방법이 아니라 위험을 줄이는 방법입니다.",
    },
    {
        "title":      "거래량이 중요한 이유",
        "log_date":   "2026-05-11",
        "mood":       "복기 필요",
        "tag":        "차트공부",
        "content":    (
            "가격이 올라도 거래량이 부족하면 힘이 약할 수 있습니다.\n"
            "반대로 거래량이 크게 붙는 구간은 시장 참여자가 많다는 뜻이므로 주의 깊게 봐야 합니다."
        ),
        "ai_comment": "가격 변화와 거래량을 함께 보는 습관을 유지해 보세요.",
    },
    {
        "title":      "삼성전자 차트 흐름 복습",
        "log_date":   "2026-05-10",
        "mood":       "복기 필요",
        "tag":        "차트공부",
        "content":    (
            "오늘은 삼성전자 차트를 보면서 이동평균선과 거래량을 같이 확인했습니다.\n"
            "단순히 가격만 보고 판단하면 안 되고, 거래량이 붙는 구간과 추세 전환 구간을 함께 봐야 한다는 점을 복습했습니다."
        ),
        "ai_comment": "가격보다 먼저 흐름과 거래량을 확인하는 습관을 유지해 보세요.",
    },
    {
        "title":      "손절 기준 없이 매수하지 않기",
        "log_date":   "2026-05-09",
        "mood":       "반성",
        "tag":        "매매원칙",
        "content":    (
            "오늘 복습한 핵심은 손절 기준입니다.\n"
            "매수 전에 손절 라인을 정하지 않으면 하락했을 때 판단이 흔들립니다.\n"
            "앞으로는 매수 이유, 목표가, 손절가를 먼저 적고 진입하기로 했습니다."
        ),
        "ai_comment": "매수 전 기준을 적는 것만으로도 충동 매매를 줄일 수 있습니다.",
    },
    {
        "title":      "PER과 PBR 개념 정리",
        "log_date":   "2026-05-08",
        "mood":       "학습 완료",
        "tag":        "재무지표",
        "content":    (
            "PER은 기업이 벌어들이는 이익 대비 주가가 어느 정도인지 보는 지표입니다.\n"
            "PBR은 기업의 순자산 대비 주가가 어느 정도인지 보는 지표입니다.\n"
            "두 지표 모두 낮다고 무조건 좋은 것은 아니고 업종과 성장성을 같이 봐야 합니다."
        ),
        "ai_comment": "지표 하나만 보지 말고 업종 평균과 기업 상황을 함께 비교해 보세요.",
    },
    {
        "title":      "모의투자 주문 화면 사용 복습",
        "log_date":   "2026-05-07",
        "mood":       "연습",
        "tag":        "모의투자",
        "content":    (
            "오늘은 모의투자 화면에서 주문 방식을 복습했습니다.\n"
            "시장가는 바로 체결될 가능성이 높지만 가격 통제가 어렵고, "
            "지정가는 원하는 가격을 정할 수 있지만 체결되지 않을 수 있습니다."
        ),
        "ai_comment": "초보 단계에서는 지정가 주문으로 가격을 의식하는 연습이 좋습니다.",
    },
    {
        "title":      "뉴스만 보고 매수하지 않기",
        "log_date":   "2026-05-06",
        "mood":       "주의",
        "tag":        "투자습관",
        "content":    (
            "뉴스를 보면 급하게 사고 싶어지는 마음이 생깁니다.\n"
            "하지만 뉴스는 이미 가격에 반영된 경우도 많기 때문에 바로 매수하지 않고 "
            "재무 상태, 차트 흐름, 거래량을 함께 확인해야 합니다."
        ),
        "ai_comment": "뉴스는 출발점일 뿐, 최종 판단 기준이 되면 위험합니다.",
    },
]


def find_user_id(email: str) -> str:
    """Supabase Auth Admin API 로 이메일로 user_id 조회"""
    page = 1
    while True:
        response = supabase_admin.auth.admin.list_users(page=page, per_page=100)
        users = response if isinstance(response, list) else getattr(response, "users", response)
        if not users:
            break
        for user in users:
            if getattr(user, "email", None) == email:
                return str(user.id)
        if len(users) < 100:
            break
        page += 1
    return ""


def main():
    print(f"[seed_study_logs] 대상 계정: {TARGET_EMAIL}")

    user_id = find_user_id(TARGET_EMAIL)
    if not user_id:
        print(f"[ERROR] '{TARGET_EMAIL}' 계정을 Supabase Auth 에서 찾을 수 없습니다.")
        print("        Supabase Dashboard 에서 계정이 존재하는지 확인해 주세요.")
        sys.exit(1)

    print(f"[OK] user_id: {user_id}")

    # 이미 해당 사용자의 기록이 있으면 중단
    existing = (
        supabase_admin.table("study_logs")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    count = existing.count or 0
    if count > 0:
        print(f"[SKIP] 이미 {count}건의 기록이 있습니다. 중복 삽입을 건너뜁니다.")
        print("       기존 데이터를 지우고 다시 실행하려면 Supabase Dashboard 에서")
        print(f"       study_logs WHERE user_id = '{user_id}' 를 DELETE 하세요.")
        sys.exit(0)

    # 삽입 데이터 준비 (user_id 주입)
    rows = [{"user_id": user_id, **log} for log in MOCK_LOGS]

    resp = supabase_admin.table("study_logs").insert(rows).execute()
    inserted = len(resp.data) if resp.data else 0
    print(f"[OK] {inserted}건 삽입 완료")
    for row in resp.data:
        print(f"     • [{row['log_date']}] {row['title']}")


if __name__ == "__main__":
    main()
