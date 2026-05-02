# stock_data/collectors/collect_prices.py

from pykrx import stock
import time, sys, os
from datetime import datetime, timedelta

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from common.db_utils import upsert_batch, log_collection, supabase


def collect_prices(start_date=None, end_date=None):
    """
    일별 가격 데이터 수집

    - 초기 수집: start_date='20230426', end_date='20260425' (3년)
    - 일별 수집: start_date='20260425', end_date='20260425' (당일)
    """
    started_at = datetime.now()

    if end_date is None:
        end_date = datetime.now().strftime("%Y%m%d")
    if start_date is None:
        # 기본: 3년 전부터
        three_years_ago = datetime.now() - timedelta(days=365*3)
        start_date = three_years_ago.strftime("%Y%m%d")

    print(f"[{started_at}] 가격 수집: {start_date} ~ {end_date}")

    # DB에서 전 종목 코드 가져오기
    result = supabase.table("stocks").select("ticker").execute()
    tickers = [row['ticker'] for row in result.data]

    all_records = []
    fail_count = 0

    for idx, ticker in enumerate(tickers):
        try:
            df = stock.get_market_ohlcv(start_date, end_date, ticker)

            if df.empty:
                continue

            for date_idx, row in df.iterrows():
                trade_date = date_idx.strftime("%Y-%m-%d")
                all_records.append({
                    "ticker":      ticker,
                    "trade_date":  trade_date,
                    "open_price":  int(row['시가']) if row['시가'] > 0 else None,
                    "high_price":  int(row['고가']) if row['고가'] > 0 else None,
                    "low_price":   int(row['저가']) if row['저가'] > 0 else None,
                    "close_price": int(row['종가']) if row['종가'] > 0 else None,
                    "volume":      int(row['거래량']),
                    "change_rate": float(row['등락률']) if '등락률' in row else None
                })

        except Exception as e:
            fail_count += 1
            print(f"  [에러] {ticker}: {e}")

        # KRX 서버 부하 방지: 1초 대기
        time.sleep(1)

        if (idx + 1) % 100 == 0:
            print(f"  진행: {idx + 1} / {len(tickers)} 종목")
            # 중간 저장 (메모리 절약)
            if all_records:
                s, f = upsert_batch("stock_prices", all_records,
                                    "ticker,trade_date")
                print(f"    중간 저장: 성공 {s} / 실패 {f}")
                all_records = []

    # 남은 데이터 최종 저장
    if all_records:
        s, f = upsert_batch("stock_prices", all_records,
                            "ticker,trade_date")
        fail_count += f

    total = len(tickers)
    status = "SUCCESS" if fail_count == 0 else "PARTIAL"
    log_collection("PRICES", status, total, total - fail_count,
                   fail_count, None, started_at)
    print(f"  수집 완료")


def collect_daily_prices():
    """매일 18:30에 실행되는 당일 가격 수집"""
    today = datetime.now().strftime("%Y%m%d")
    collect_prices(start_date=today, end_date=today)


if __name__ == "__main__":
    # 첫 실행: 전체 3년치
    collect_prices()