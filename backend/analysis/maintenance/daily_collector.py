# analysis/maintenance/daily_collector.py
#
# 실행 방법:
#   로컬 데몬 모드 : python daily_collector.py          (매일 18:30 자동 실행)
#   Render Cron 모드: python daily_collector.py --once   (즉시 1회 실행 후 종료)

import sys
import os
import argparse
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from collectors.collect_stocks import collect_all_stocks
from collectors.collect_prices import collect_daily_prices
from collectors.collect_warnings import collect_admin_stocks


def daily_job():
    """
    일별 수집 작업
    1) 종목 기본정보 갱신 (신규 상장·상장폐지 반영)
    2) 당일 가격 수집
    3) 위험 경고 갱신
    """
    print("=" * 60)
    print(f"[일별 수집 시작] {datetime.now()}")
    print("=" * 60)

    try:
        print("\n▶ Step 1: 종목 기본정보 갱신")
        collect_all_stocks()
    except Exception as e:
        print(f"  [실패] 종목 기본정보: {e}")

    try:
        print("\n▶ Step 2: 당일 가격 수집")
        collect_daily_prices()
    except Exception as e:
        print(f"  [실패] 가격: {e}")

    try:
        print("\n▶ Step 3: 위험 경고 갱신")
        collect_admin_stocks()
    except Exception as e:
        print(f"  [실패] 위험 경고: {e}")

    print("\n" + "=" * 60)
    print(f"[일별 수집 완료] {datetime.now()}")
    print("=" * 60)


def quarterly_job():
    """
    분기 수집 작업 (1·4·7·10월 첫째 주)
    재무제표 데이터 갱신
    """
    print("=" * 60)
    print(f"[분기 수집 시작] {datetime.now()}")
    print("=" * 60)

    try:
        from collectors.collect_financials import collect_all_financials
        collect_all_financials()
    except Exception as e:
        print(f"  [실패] 재무 지표: {e}")

    print(f"[분기 수집 완료] {datetime.now()}")


def _is_quarterly():
    """분기 첫째 주 여부 판단."""
    now = datetime.now()
    return now.month in [1, 4, 7, 10] and now.day <= 7


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SafeInvest AI 데이터 수집기")
    parser.add_argument(
        "--once",
        action="store_true",
        help="즉시 1회 실행 후 종료 (Render Cron Job 전용)",
    )
    args = parser.parse_args()

    if args.once:
        # ── Render Cron Job 모드: 1회 실행 후 종료 ──
        print("━" * 60)
        print("  SafeInvest AI - 데이터 수집 (Cron 1회 실행)")
        print(f"  실행 시간: {datetime.now()}")
        print("━" * 60)

        daily_job()

        if _is_quarterly():
            print("\n▶ 분기 수집 조건 충족 — 재무 데이터 수집 실행")
            quarterly_job()

        print("\n✅ Cron Job 완료")

    else:
        # ── 로컬 데몬 모드: 스케줄러 상시 대기 ──
        import schedule
        import time

        schedule.every().day.at("18:30").do(daily_job)
        schedule.every().day.at("02:00").do(
            lambda: quarterly_job() if _is_quarterly() else None
        )

        print("━" * 60)
        print("  SafeInvest AI - 데이터 자동 수집 스케줄러")
        print(f"  시작 시간: {datetime.now()}")
        print("  일별 수집: 매일 18:30 KST")
        print("  분기 수집: 1·4·7·10월 첫째 주 02:00 KST")
        print("  종료: Ctrl+C")
        print("━" * 60)

        while True:
            schedule.run_pending()
            time.sleep(60)
