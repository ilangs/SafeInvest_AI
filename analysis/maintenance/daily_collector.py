# stock_data/maintenance/daily_collector.py

import schedule
import time
import sys
import os
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from collectors.collect_stocks import collect_all_stocks
from collectors.collect_prices import collect_daily_prices
from collectors.collect_warnings import collect_admin_stocks


def daily_job():
    """
    매일 18:30에 실행되는 작업
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
    분기마다 실행되는 작업 (1월, 4월, 7월, 10월 첫째 주)
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


# ─── 스케줄 등록 ───
# 매일 18:30에 일별 수집
schedule.every().day.at("18:30").do(daily_job)

# 분기별 재무 수집 (매월 1일 02:00에 실행, 코드 안에서 분기 판단)
schedule.every().day.at("02:00").do(
    lambda: quarterly_job() if datetime.now().month in [1, 4, 7, 10]
            and datetime.now().day <= 7 else None
)


if __name__ == "__main__":
    print("━" * 60)
    print("  SafeInvest AI - 데이터 자동 수집 스케줄러")
    print(f"  시작 시간: {datetime.now()}")
    print("  일별 수집: 매일 18:30")
    print("  분기 수집: 1·4·7·10월 첫째 주 02:00")
    print("  종료하려면 Ctrl+C 를 누르세요")
    print("━" * 60)

    while True:
        schedule.run_pending()
        time.sleep(60)  # 1분마다 스케줄 확인