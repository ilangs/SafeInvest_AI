# stock_data/collectors/collect_stocks.py

import FinanceDataReader as fdr
from datetime import datetime
import sys, os

# 상위 폴더의 common 모듈을 사용하기 위한 경로 설정
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from common.db_utils import upsert_batch, log_collection


def clean_ticker(raw_ticker):
    """
    티커를 항상 6자리 숫자 문자열로 만드는 함수
    예: '5930' → '005930',  5930 → '005930'
    """
    return str(raw_ticker).strip().zfill(6)


def collect_all_stocks():
    """코스피 + 코스닥 전 종목 수집"""
    started_at = datetime.now()
    print(f"[{started_at}] 종목 기본정보 수집 시작")

    records = []

    # 코스피 종목 가져오기
    df_kospi = fdr.StockListing('KOSPI')
    for _, row in df_kospi.iterrows():
        records.append({
            "ticker":       clean_ticker(row['Symbol']),
            "stock_name":   str(row['Name']).strip(),
            "market":       "KOSPI",
            "sector":       str(row.get('Sector', '')).strip() or None,
            "industry":     str(row.get('Industry', '')).strip() or None,
            "updated_at":   datetime.now().isoformat()
        })

    # 코스닥 종목 가져오기
    df_kosdaq = fdr.StockListing('KOSDAQ')
    for _, row in df_kosdaq.iterrows():
        records.append({
            "ticker":       clean_ticker(row['Symbol']),
            "stock_name":   str(row['Name']).strip(),
            "market":       "KOSDAQ",
            "sector":       str(row.get('Sector', '')).strip() or None,
            "industry":     str(row.get('Industry', '')).strip() or None,
            "updated_at":   datetime.now().isoformat()
        })

    total = len(records)
    print(f"  수집 완료: 코스피 {len(df_kospi)}개 + 코스닥 {len(df_kosdaq)}개 = 총 {total}개")

    # DB에 저장 (ticker가 같으면 업데이트)
    success, fail = upsert_batch("stocks", records, "ticker")

    status = "SUCCESS" if fail == 0 else ("PARTIAL" if success > 0 else "FAIL")
    log_collection("STOCKS", status, total, success, fail, None, started_at)
    print(f"  DB 저장 완료: 성공 {success} / 실패 {fail}")


if __name__ == "__main__":
    collect_all_stocks()