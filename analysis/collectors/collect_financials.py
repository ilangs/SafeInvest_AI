# stock_data/collectors/collect_financials.py

import OpenDartReader
import os, sys, time
from datetime import datetime
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from common.db_utils import upsert_batch, log_collection, supabase

load_dotenv()
dart = OpenDartReader(os.getenv("DART_API_KEY"))

# 수집 대상 연도 (최근 3년)
TARGET_YEARS = [2023, 2024, 2025]

# 분기 코드 매핑
QUARTER_MAP = {
    '11013': 'Q1',
    '11012': 'Q2',
    '11014': 'Q3',
    '11011': 'FY'
}


def clean_number(value):
    """
    DART에서 받은 금액 문자열을 숫자로 변환
    예: '230,400,881,000,000' → 230400881000000
    """
    if value is None or str(value).strip() in ['', '-', 'N/A']:
        return None
    try:
        return int(str(value).replace(',', ''))
    except ValueError:
        return None


def extract_financial_record(ticker, year, quarter_code, df):
    """
    DART finstate 결과(DataFrame)에서
    필요한 항목만 뽑아 DB 레코드로 만드는 함수
    """
    if df is None or df.empty:
        return None

    # 연결재무제표(CFS) 우선, 없으면 개별(OFS)
    cfs = df[df['fs_div'] == 'CFS']
    if cfs.empty:
        cfs = df[df['fs_div'] == 'OFS']
    if cfs.empty:
        return None

    def find_amount(sj_nm, account_keyword):
        """특정 재무제표(BS/IS)에서 특정 계정명을 찾아 금액 반환"""
        rows = cfs[
            (cfs['sj_nm'] == sj_nm) &
            (cfs['account_nm'].str.contains(account_keyword, na=False))
        ]
        if rows.empty:
            return None
        return clean_number(rows.iloc[0]['thstrm_amount'])

    revenue          = find_amount('손익계산서', '매출액')
    operating_profit = find_amount('손익계산서', '영업이익')
    net_income       = find_amount('손익계산서', '당기순이익')
    total_equity     = find_amount('재무상태표', '자본총계')
    total_debt       = find_amount('재무상태표', '부채총계')
    total_capital    = find_amount('재무상태표', '자본금')

    # ROE 계산: 당기순이익 ÷ 자본총계 × 100
    roe = None
    if net_income is not None and total_equity and total_equity != 0:
        roe = round(net_income / total_equity * 100, 2)

    # 부채비율 계산: 부채총계 ÷ 자본총계 × 100
    debt_ratio = None
    if total_debt is not None and total_equity and total_equity != 0:
        debt_ratio = round(total_debt / total_equity * 100, 2)

    # 자본잠식 판단: 자본총계가 자본금보다 작으면 잠식
    capital_impairment = False
    if total_equity is not None and total_capital is not None:
        if total_equity < total_capital:
            capital_impairment = True

    return {
        "ticker":             ticker,
        "fiscal_year":        year,
        "fiscal_quarter":     QUARTER_MAP[quarter_code],
        "revenue":            revenue,
        "operating_profit":   operating_profit,
        "net_income":         net_income,
        "roe":                roe,
        "debt_ratio":         debt_ratio,
        "capital_impairment": capital_impairment,
        "updated_at":         datetime.now().isoformat()
    }


def collect_all_financials():
    """전 종목 재무 데이터 수집"""
    started_at = datetime.now()
    print(f"[{started_at}] 재무 지표 수집 시작")

    # DB에서 전 종목 코드 가져오기
    result = supabase.table("stocks").select("ticker").execute()
    tickers = [row['ticker'] for row in result.data]

    records = []
    fail_count = 0

    for idx, ticker in enumerate(tickers):
        for year in TARGET_YEARS:
            for reprt_code in ['11011', '11012']:
                # 연간(FY)과 반기(Q2)만 우선 수집
                # (전 분기를 모두 수집하면 API 호출량이 매우 많아짐)
                try:
                    df = dart.finstate(corp=ticker, bsns_year=year,
                                       reprt_code=reprt_code)
                    record = extract_financial_record(
                        ticker, year, reprt_code, df
                    )
                    if record:
                        records.append(record)
                except Exception as e:
                    fail_count += 1
                    if "EXCEEDED" in str(e).upper():
                        print("  API 호출 한도 초과. 1분 대기...")
                        time.sleep(60)

                # DART API는 분당 호출 제한이 있으므로 0.5초 대기
                time.sleep(0.5)

        # 진행 상황 출력 (100개마다)
        if (idx + 1) % 100 == 0:
            print(f"  진행: {idx + 1} / {len(tickers)} 종목 완료")

    total = len(records) + fail_count
    success, db_fail = upsert_batch(
        "stock_financials", records, "ticker,fiscal_year,fiscal_quarter"
    )
    total_fail = fail_count + db_fail

    status = "SUCCESS" if total_fail == 0 else "PARTIAL"
    log_collection("FINANCIALS", status, total, success, total_fail,
                   None, started_at)
    print(f"  DB 저장 완료: 성공 {success} / 실패 {total_fail}")


if __name__ == "__main__":
    collect_all_financials()