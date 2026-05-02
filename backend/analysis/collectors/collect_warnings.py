# stock_data/collectors/collect_warnings.py

import OpenDartReader
import requests
import os, sys, time
from datetime import datetime
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from common.db_utils import upsert_batch, log_collection, supabase

load_dotenv()
dart = OpenDartReader(os.getenv("DART_API_KEY"))


def collect_admin_stocks():
    """관리종목·투자주의·경고 종목 수집"""
    started_at = datetime.now()
    print(f"[{started_at}] 위험 경고 수집 시작")

    records = []

    # 방법 1: DART에서 감사의견 조회 (최근 3년)
    for year in [2023, 2024, 2025]:
        try:
            # DART 감사보고서 전문 조회 API 활용
            # (실제 구현 시 DART 감사의견 관련 API 사용)
            pass
        except Exception as e:
            print(f"  [에러] 감사의견 {year}: {e}")

    # 방법 2: KRX에서 관리종목 리스트 조회
    # KRX KIND는 웹 크롤링 또는 별도 API 이용
    # (아래는 구조 예시. 실제 URL과 파라미터는 KRX 사이트에서 확인 필요)
    try:
        # pykrx에서 관리종목 여부 확인도 가능
        from pykrx import stock as pykrx_stock

        today = datetime.now().strftime("%Y%m%d")
        tickers_kospi = pykrx_stock.get_market_ticker_list(today, market="KOSPI")
        tickers_kosdaq = pykrx_stock.get_market_ticker_list(today, market="KOSDAQ")

        # 관리종목은 별도 목록이 아니므로,
        # 재무 데이터 기반으로 자본잠식·연속적자를 판단하여 경고 레코드 생성
        result = supabase.table("stock_financials") \
            .select("ticker, fiscal_year, capital_impairment, net_income") \
            .eq("capital_impairment", True) \
            .execute()

        for row in result.data:
            records.append({
                "ticker":          row['ticker'],
                "warning_type":    "CAPITAL_IMPAIRMENT",
                "designated_date": f"{row['fiscal_year']}-12-31",
                "reason":          f"{row['fiscal_year']}년 자본잠식 확인",
                "is_active":       True,
                "updated_at":      datetime.now().isoformat()
            })

    except Exception as e:
        print(f"  [에러] 관리종목 수집: {e}")

    total = len(records)
    if records:
        success, fail = upsert_batch("stock_warnings", records, "id")
    else:
        success, fail = 0, 0

    status = "SUCCESS" if fail == 0 else "PARTIAL"
    log_collection("WARNINGS", status, total, success, fail,
                   None, started_at)
    print(f"  DB 저장 완료: 성공 {success} / 실패 {fail}")


if __name__ == "__main__":
    collect_admin_stocks()