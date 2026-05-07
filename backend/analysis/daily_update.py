"""
SafeInvest AI - 일일 증분 데이터 수집 (Supabase 버전)
실행: python -m backend.analysis.daily_update
      또는 cd backend/analysis && python daily_update.py

원본(streamlit/SQLite) → Supabase 포팅:
  - STOCKS / STOCK_PRICES / STOCK_FINANCIALS / STOCK_WARNINGS 모두 Supabase 테이블 사용
  - 컬럼명 매핑: name→stock_name, date→trade_date, open→open_price,
                 year→fiscal_year, quarter→fiscal_quarter, net_profit→net_income
  - boolean 타입: is_active / capital_impairment 모두 PostgreSQL BOOLEAN 사용
  - migration_06 의 total_assets/total_equity/total_liabilities/data_source 컬럼 활용

기본 실행 순서: STEP4 신규상장 → STEP1 주가 → STEP2 재무 → STEP3 경고 재계산
완료 후 자동으로 data_quality_check.py 호출.
"""

import os
import sys
import time
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

# httpx 예외 (Supabase HTTP/2 stream reset 대응)
try:
    import httpx
    _HTTPX_NETWORK_ERRORS = (
        httpx.RemoteProtocolError, httpx.ReadError,
        httpx.ConnectError,        httpx.ReadTimeout,
        httpx.WriteError,          httpx.PoolTimeout,
    )
except ImportError:
    _HTTPX_NETWORK_ERRORS = (Exception,)


def _retry_call(fn, *args, max_retries: int = 3, label: str = "", **kwargs):
    """일시적 네트워크 오류(HTTP/2 StreamReset 등) 재시도. 마지막 실패 시 raise."""
    last_exc = None
    for attempt in range(max_retries):
        try:
            return fn(*args, **kwargs)
        except _HTTPX_NETWORK_ERRORS as e:
            last_exc = e
            wait = 1.5 ** attempt
            logging.getLogger(__name__).warning(
                f"  [재시도 {attempt+1}/{max_retries}] {label} → "
                f"{type(e).__name__} → {wait:.1f}s 대기"
            )
            time.sleep(wait)
    raise last_exc if last_exc else RuntimeError("retry exhausted")

# ── 환경 설정 ──────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent      # backend/
LOG_DIR  = BASE_DIR / "analysis" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = LOG_DIR / f"daily_update_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

# .env 로드
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

DART_API_KEY = os.getenv("DART_API_KEY", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)

# ── Supabase 클라이언트 (service_role 키로 RLS 우회) ──
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.")
    sys.exit(1)

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 배치 크기 (Supabase upsert 제한 회피)
BATCH = 500


# ══════════════════════════════════════════════════════
# 공통 유틸
# ══════════════════════════════════════════════════════
def fetch_all(table: str, columns: str = "*", filters: dict | None = None,
              order: tuple | None = None) -> list:
    """Supabase 페이지네이션 조회 (모든 행). 페이지 단위 재시도."""
    rows: list = []
    page_size = 500     # HTTP/2 stream reset 회피
    offset = 0
    while True:
        def _fetch_page(_off=offset):
            q = sb.table(table).select(columns)
            if filters:
                for k, v in filters.items():
                    q = q.eq(k, v)
            if order:
                col, desc = order
                q = q.order(col, desc=desc)
            q = q.range(_off, _off + page_size - 1)
            return q.execute()
        try:
            res = _retry_call(_fetch_page, label=f"fetch_all({table}) offset={offset}")
        except Exception as e:
            log.error(f"  [fetch_all 실패] {table} offset={offset}: {type(e).__name__}: {e}")
            break
        chunk = res.data or []
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return rows


def upsert_chunked(table: str, records: list, on_conflict: str | None = None):
    """대량 records 를 BATCH 크기로 분할 upsert. 청크 단위 재시도."""
    if not records:
        return 0
    success = 0
    for i in range(0, len(records), BATCH):
        chunk = records[i:i + BATCH]
        def _do():
            q = sb.table(table)
            if on_conflict:
                return q.upsert(chunk, on_conflict=on_conflict).execute()
            return q.upsert(chunk).execute()
        try:
            _retry_call(_do, label=f"upsert({table}) chunk {i}")
            success += len(chunk)
        except Exception as e:
            log.warning(f"  [upsert 실패] {table} 청크 {i}~{i+len(chunk)}: {type(e).__name__}: {e}")
    return success


# ══════════════════════════════════════════════════════
# STEP 1: stock_prices 증분 수집 (pykrx)
#   - 각 ticker 별 MAX(trade_date) 조회 후 다음날부터 오늘까지
#   - upsert (ticker, trade_date) PK 충돌 방지
# ══════════════════════════════════════════════════════
def update_prices():
    log.info("=" * 60)
    log.info("STEP 1: stock_prices 증분 수집 시작")

    try:
        from pykrx import stock as krx
    except ImportError:
        log.error("pykrx 미설치: pip install pykrx")
        return

    today_str  = datetime.now().strftime("%Y%m%d")
    today_date = datetime.now().strftime("%Y-%m-%d")

    # 전체 종목 목록
    stock_rows = fetch_all("stocks", "ticker", order=("ticker", False))
    tickers = [r["ticker"] for r in stock_rows]
    log.info(f"  대상 종목 수: {len(tickers)}")

    # 각 ticker 의 최신 trade_date 조회 (페이지네이션)
    # → Supabase 한 번에 GROUP BY 가 어려우므로 ticker 별 max 를 한 번에 가져오는
    #   가벼운 RPC 가 없다면 ticker 단위 호출 (느림). 여기서는 일괄 조회 후 Python 처리.
    log.info("  최신 거래일 조회 중...")
    last_dates: dict[str, str] = {}
    # 모든 (ticker, trade_date) 가져와서 max 계산하면 너무 많음 →
    # 종목별 1행만 조회 (order desc + limit 1)
    for idx, ticker in enumerate(tickers, 1):
        if idx % 500 == 0:
            log.info(f"    {idx}/{len(tickers)}")
        res = (sb.table("stock_prices")
                 .select("trade_date")
                 .eq("ticker", ticker)
                 .order("trade_date", desc=True)
                 .limit(1)
                 .execute())
        if res.data:
            last_dates[ticker] = res.data[0]["trade_date"]

    total_inserted = 0
    skipped = 0
    errors  = 0

    for i, ticker in enumerate(tickers, 1):
        last_date = last_dates.get(ticker)

        if last_date == today_date:
            skipped += 1
            continue

        if last_date:
            start_dt = datetime.strptime(last_date, "%Y-%m-%d") + timedelta(days=1)
        else:
            start_dt = datetime.now() - timedelta(days=30)
        start_str = start_dt.strftime("%Y%m%d")

        if start_str > today_str:
            skipped += 1
            continue

        try:
            df = krx.get_market_ohlcv(start_str, today_str, ticker)
            if df is None or df.empty:
                continue

            df = df.reset_index()
            df.columns = [c.strip() for c in df.columns]
            col_map = {
                "날짜": "date", "시가": "open", "고가": "high",
                "저가": "low",  "종가": "close", "거래량": "volume",
                "거래대금": "amount"
            }
            df = df.rename(columns=col_map)
            if "date" not in df.columns:
                continue
            df["date"] = df["date"].astype(str).str[:10]
            df = df[df["date"] <= today_date]
            if df.empty:
                continue
            if "amount" not in df.columns:
                df["amount"] = 0

            records = []
            for _, r in df.iterrows():
                records.append({
                    "ticker":      ticker,
                    "trade_date":  r["date"],
                    "open_price":  int(r["open"])   if r.get("open")   is not None else None,
                    "high_price":  int(r["high"])   if r.get("high")   is not None else None,
                    "low_price":   int(r["low"])    if r.get("low")    is not None else None,
                    "close_price": int(r["close"])  if r.get("close")  is not None else None,
                    "volume":      int(r["volume"]) if r.get("volume") is not None else 0,
                    "amount":      str(r.get("amount") or 0),
                })

            n = upsert_chunked("stock_prices", records, on_conflict="ticker,trade_date")
            total_inserted += n
            if n > 0:
                log.info(f"  [{i:4d}/{len(tickers)}] {ticker} +{n}행 ({start_str}~{today_str})")

        except Exception as e:
            errors += 1
            log.warning(f"  [{i:4d}] {ticker} 오류: {e}")

        time.sleep(0.2)   # KRX 부하 방지

    log.info(f"STEP 1 완료: +{total_inserted}행 / {skipped}건 스킵 / {errors}건 오류")


# ══════════════════════════════════════════════════════
# STEP 2: stock_financials 증분 수집 (DART/OpenDartReader)
#   - 새 분기 INSERT + 기존 NaN 보충 UPDATE
# ══════════════════════════════════════════════════════
def update_financials():
    log.info("=" * 60)
    log.info("STEP 2: stock_financials 증분 수집 시작")

    if not DART_API_KEY:
        log.warning("  DART_API_KEY 없음 - 재무 증분 스킵")
        return

    try:
        import OpenDartReader
    except ImportError:
        log.error("  OpenDartReader 미설치: pip install OpenDartReader")
        return

    try:
        dart = OpenDartReader(DART_API_KEY)
    except Exception as e:
        log.error(f"  OpenDartReader 초기화 실패: {e}")
        return

    # 현재 DB 최신 연도/분기
    latest_rows = fetch_all("stock_financials", "fiscal_year,fiscal_quarter")
    if latest_rows:
        latest_year_str = max(r["fiscal_year"] for r in latest_rows if r.get("fiscal_year"))
        latest_year = int(latest_year_str) if latest_year_str else 2024
        latest_quarters = [r["fiscal_quarter"] for r in latest_rows
                           if r.get("fiscal_year") == latest_year_str]
        latest_quarter = max(latest_quarters) if latest_quarters else "Q4"
    else:
        latest_year, latest_quarter = 2024, "Q4"
    log.info(f"  현재 최신 데이터: {latest_year} {latest_quarter}")

    now = datetime.now()
    current_year  = now.year
    current_month = now.month

    quarter_schedule = [
        ("Q1", {"reprt_code": "11013", "avail_month": 5,  "window_months": 3}),
        ("Q2", {"reprt_code": "11012", "avail_month": 8,  "window_months": 3}),
        ("Q3", {"reprt_code": "11014", "avail_month": 11, "window_months": 3}),
        ("Q4", {"reprt_code": "11011", "avail_month": 3,  "window_months": 4}),
    ]
    NAN_THRESHOLD = 0.05

    def is_in_window(yr, q_info):
        avail = q_info["avail_month"]
        window = q_info["window_months"]
        window_start_year = yr + 1 if q_info["reprt_code"] == "11011" else yr
        if current_year != window_start_year:
            return False
        return avail <= current_month < (avail + window)

    def is_quarter_available(yr, q_info):
        avail = q_info["avail_month"]
        avail_year = yr + 1 if q_info["reprt_code"] == "11011" else yr
        if current_year > avail_year:
            return True
        if current_year == avail_year and current_month >= avail:
            return True
        return False

    # ── 수집 대상 결정 ──
    # 분기별 (count, NaN 후보) 를 미리 계산
    log.info("  대상 분기 결정 중...")
    collect_targets: list[tuple] = []   # (year, quarter, reprt_code, target_tickers|None)

    for yr in range(latest_year - 1, current_year + 1):
        for q, info in quarter_schedule:
            if not is_quarter_available(yr, info):
                continue

            # 해당 분기 row 개수
            cnt_res = (sb.table("stock_financials")
                         .select("ticker", count="exact")
                         .eq("fiscal_year", str(yr))
                         .eq("fiscal_quarter", q)
                         .limit(1)
                         .execute())
            exists = cnt_res.count or 0
            if exists == 0:
                collect_targets.append((yr, q, info["reprt_code"], None))
                continue

            # NaN 후보 ticker 목록
            nan_candidates = (sb.table("stock_financials")
                                .select("ticker,revenue,operating_profit,net_income,total_assets,data_source")
                                .eq("fiscal_year", str(yr))
                                .eq("fiscal_quarter", q)
                                .execute()).data or []
            nan_tickers = [
                r["ticker"] for r in nan_candidates
                if (r.get("revenue") is None
                    or r.get("operating_profit") is None
                    or r.get("net_income") is None
                    or r.get("total_assets") is None)
                and (r.get("data_source") or "") != "financial_skip"
            ]
            nan_ratio = len(nan_tickers) / exists if exists else 0
            in_window = is_in_window(yr, info)

            if (in_window and nan_tickers) or nan_ratio >= NAN_THRESHOLD:
                collect_targets.append((yr, q, info["reprt_code"], nan_tickers))

    if not collect_targets:
        log.info("  새로운/누락 분기 데이터 없음 - 스킵")
        return

    for yr, q, _, tgt in collect_targets:
        if tgt is None:
            log.info(f"  수집 대상: {yr} {q} (신규 전체)")
        else:
            log.info(f"  수집 대상: {yr} {q} (NaN catch-up {len(tgt)}종목)")

    def get_val(df, sj_div_filter, *keywords):
        sub = df if sj_div_filter is None else df[df["sj_div"] == sj_div_filter]
        if sub is None or sub.empty:
            return None
        for kw in keywords:
            row = sub[sub["account_nm"].str.contains(kw, na=False, regex=False)]
            if not row.empty:
                val = row.iloc[0].get("thstrm_amount", None)
                if val is not None and str(val).strip() not in ("", "-"):
                    try:
                        return float(str(val).replace(",", ""))
                    except Exception:
                        pass
        return None

    total_inserted = 0
    total_updated  = 0
    total_skipped  = 0

    # 전체 종목 캐시
    all_tickers = [r["ticker"] for r in fetch_all("stocks", "ticker", order=("ticker", False))]

    for year, quarter, reprt_code, target_tickers in collect_targets:
        log.info(f"  {year} {quarter} 수집 시작 (reprt_code={reprt_code})...")
        ins_cnt = upd_cnt = skip_cnt = no_data_cnt = err_cnt = 0
        records_to_upsert: list = []

        if target_tickers is None:
            tickers = all_tickers
            mode = "INSERT"
        else:
            tickers = target_tickers
            mode = "UPDATE"

        for idx, ticker in enumerate(tickers, 1):
            if idx % 100 == 0:
                log.info(f"    진행: {idx}/{len(tickers)} (ins={ins_cnt}, upd={upd_cnt}, no_data={no_data_cnt})")
            try:
                # corp_code 조회
                try:
                    corp_code = dart.find_corp_code(ticker)
                except Exception:
                    corp_code = None
                if not corp_code:
                    skip_cnt += 1
                    continue

                # 재무제표 조회 (CFS 우선, 실패 시 OFS)
                df = None
                for fs_div in ("CFS", "OFS"):
                    try:
                        df = dart.finstate_all(ticker, int(year), reprt_code=reprt_code, fs_div=fs_div)
                        if df is not None and len(df) > 0:
                            break
                    except Exception:
                        df = None
                        continue

                if df is None or len(df) == 0 or "sj_div" not in df.columns or "account_nm" not in df.columns:
                    no_data_cnt += 1
                    continue

                revenue           = get_val(df, "IS", "매출액", "영업수익", "수익(매출액)")
                operating_profit  = get_val(df, "IS", "영업이익")
                net_income        = get_val(df, "IS", "당기순이익", "분기순이익", "반기순이익", "당기순손익")
                total_assets      = get_val(df, "BS", "자산총계")
                total_equity      = get_val(df, "BS", "자본총계")
                total_liabilities = get_val(df, "BS", "부채총계")

                debt_ratio = None
                if total_equity and total_equity != 0 and total_liabilities is not None:
                    debt_ratio = round(total_liabilities / total_equity * 100, 2)
                roe = None
                if total_equity and total_equity != 0 and net_income is not None:
                    roe = round(net_income / total_equity * 100, 2)
                capital_impairment = bool(total_equity is not None and total_equity < 0)

                if all(v is None for v in [revenue, operating_profit, net_income, total_assets]):
                    no_data_cnt += 1
                    continue

                if mode == "INSERT":
                    records_to_upsert.append({
                        "ticker":             ticker,
                        "fiscal_year":        str(year),
                        "fiscal_quarter":     quarter,
                        "revenue":            int(revenue)            if revenue            is not None else None,
                        "operating_profit":   int(operating_profit)   if operating_profit   is not None else None,
                        "net_income":         int(net_income)         if net_income         is not None else None,
                        "total_assets":       int(total_assets)       if total_assets       is not None else None,
                        "total_equity":       int(total_equity)       if total_equity       is not None else None,
                        "total_liabilities":  int(total_liabilities)  if total_liabilities  is not None else None,
                        "debt_ratio":         debt_ratio,
                        "roe":                roe,
                        "capital_impairment": capital_impairment,
                        "data_source":        "DART",
                    })
                    ins_cnt += 1
                else:
                    # NaN catch-up: 기존 행 SELECT 후 NULL 컬럼만 채워서 update
                    cur = (sb.table("stock_financials")
                             .select("*")
                             .eq("ticker", ticker)
                             .eq("fiscal_year", str(year))
                             .eq("fiscal_quarter", quarter)
                             .maybe_single()
                             .execute())
                    if not cur or not cur.data:
                        continue
                    cur_data = cur.data
                    patch = {}
                    candidates = {
                        "revenue":            int(revenue)            if revenue            is not None else None,
                        "operating_profit":   int(operating_profit)   if operating_profit   is not None else None,
                        "net_income":         int(net_income)         if net_income         is not None else None,
                        "total_assets":       int(total_assets)       if total_assets       is not None else None,
                        "total_equity":       int(total_equity)       if total_equity       is not None else None,
                        "total_liabilities":  int(total_liabilities)  if total_liabilities  is not None else None,
                        "debt_ratio":         debt_ratio,
                        "roe":                roe,
                    }
                    for col, v in candidates.items():
                        if v is not None and cur_data.get(col) is None:
                            patch[col] = v
                    if cur_data.get("capital_impairment") is None:
                        patch["capital_impairment"] = capital_impairment
                    if patch:
                        # data_source 표시
                        ds = cur_data.get("data_source") or ""
                        if not ds:
                            patch["data_source"] = "DART_patched"
                        elif "DART" in ds:
                            patch["data_source"] = ds
                        else:
                            patch["data_source"] = ds + "+DART"
                        try:
                            (sb.table("stock_financials").update(patch)
                               .eq("ticker", ticker)
                               .eq("fiscal_year", str(year))
                               .eq("fiscal_quarter", quarter)
                               .execute())
                            upd_cnt += 1
                        except Exception as e:
                            err_cnt += 1
                            log.debug(f"    UPDATE 실패 {ticker} {year}{quarter}: {e}")

            except Exception as e:
                err_cnt += 1
                log.debug(f"    {ticker} {year}{quarter} 오류: {type(e).__name__}: {e}")

            time.sleep(0.3)   # DART rate limit

        # INSERT 모드는 모은 records 일괄 upsert
        if mode == "INSERT" and records_to_upsert:
            n = upsert_chunked("stock_financials", records_to_upsert,
                               on_conflict="ticker,fiscal_year,fiscal_quarter")
            log.info(f"  {year} {quarter} 신규 upsert: +{n}건")
            total_inserted += n
        else:
            total_updated += upd_cnt

        log.info(f"  {year} {quarter} 완료: ins={ins_cnt}, upd={upd_cnt}, no_data={no_data_cnt}, skip={skip_cnt}, err={err_cnt}")
        total_skipped += (skip_cnt + no_data_cnt)

    log.info(f"STEP 2 완료: 신규 +{total_inserted}건, NaN 보충 {total_updated}건, 미공시/skip {total_skipped}건")


# ══════════════════════════════════════════════════════
# STEP 3: stock_warnings 재계산
#   - 각 ticker 의 최신 (fiscal_year, fiscal_quarter) 기준
# ══════════════════════════════════════════════════════
def update_warnings():
    log.info("=" * 60)
    log.info("STEP 3: stock_warnings 재계산 시작")

    today = datetime.now().strftime("%Y-%m-%d")

    # 모든 재무 데이터 가져와서 Python 에서 최신 분기 결정
    log.info("  재무 데이터 로딩...")
    all_fin = fetch_all("stock_financials",
                        "ticker,fiscal_year,fiscal_quarter,revenue,operating_profit,net_income,"
                        "total_assets,total_equity,total_liabilities,debt_ratio,capital_impairment")
    log.info(f"  전체 재무 행 수: {len(all_fin)}")

    import pandas as pd
    df = pd.DataFrame(all_fin)
    if df.empty:
        log.warning("  재무 데이터 없음 - 종료")
        return
    # 분기 가중치 — Q4 > Q3 > Q2 > Q1 > A (텍스트 정렬은 Q4 가장 큼, A는 별도)
    df = df[df["fiscal_quarter"].isin(["Q1", "Q2", "Q3", "Q4", "A"])].copy()
    df["yq"] = df["fiscal_year"] + "-" + df["fiscal_quarter"]
    # ticker 별 최신 1행만 추출
    latest_idx = df.groupby("ticker")["yq"].idxmax()
    latest_df = df.loc[latest_idx].reset_index(drop=True)
    log.info(f"  최신 재무 평가 대상: {len(latest_df)}종목")

    # 3년 연속 적자용 데이터 (fiscal_quarter = Q4 또는 A)
    cutoff_year = str(datetime.now().year - 3)
    loss_df = df[(df["fiscal_quarter"].isin(["A", "Q4"])) & (df["fiscal_year"] >= cutoff_year)] \
              [["ticker", "fiscal_year", "net_income"]].copy()

    # 활성 경고 캐시 (한 번에 가져와서 dict 화)
    log.info("  활성 경고 로딩...")
    active_warns_raw = fetch_all("stock_warnings",
                                 "id,ticker,warning_type,reason",
                                 filters={"is_active": True})
    active_map: dict[str, dict] = {}    # ticker → {warning_type: (id, reason)}
    for w in active_warns_raw:
        active_map.setdefault(w["ticker"], {})[w["warning_type"]] = (w["id"], w.get("reason", ""))

    new_warnings = msg_updated = released_count = 0

    def safe_float(v):
        if v is None:
            return None
        try:
            f = float(v)
            if pd.isna(f):
                return None
            return f
        except (TypeError, ValueError):
            return None

    inserts: list = []
    updates_msg: list = []
    deactivations: list = []

    for _, row in latest_df.iterrows():
        ticker  = row["ticker"]
        equity  = safe_float(row.get("total_equity"))
        debt_r  = safe_float(row.get("debt_ratio"))
        revenue = safe_float(row.get("revenue"))
        cap_imp = row.get("capital_impairment")

        warnings_to_check: list[tuple] = []

        # ① 자본잠식
        if cap_imp is True or (equity is not None and equity < 0):
            warnings_to_check.append(("CAPITAL_IMPAIRMENT", "자본잠식 상태: 총자본이 음수입니다"))

        # ② 고부채
        if debt_r is not None and debt_r > 200:
            warnings_to_check.append(("HIGH_DEBT", f"부채비율 {debt_r:.0f}% 초과 (기준: 200%)"))

        # ③ 3년 연속 적자
        ticker_loss = loss_df[loss_df["ticker"] == ticker]
        if len(ticker_loss) >= 3:
            recent_3y = ticker_loss.sort_values("fiscal_year", ascending=False).head(3)
            np_values = [safe_float(v) for v in recent_3y["net_income"].tolist()]
            np_clean  = [v for v in np_values if v is not None]
            if len(np_clean) >= 3 and all(v < 0 for v in np_clean):
                warnings_to_check.append(("CONTINUOUS_LOSS", "3년 연속 순손실 발생"))

        # ④ 매출 미달
        if revenue is not None and revenue < 1_000_000_000:
            warnings_to_check.append(("LOW_REVENUE", f"매출액 {revenue:,.0f}원 (기준: 10억)"))

        existing = active_map.get(ticker, {})
        current_types = set()
        for warn_type, reason in warnings_to_check:
            current_types.add(warn_type)
            if warn_type in existing:
                old_id, old_reason = existing[warn_type]
                if old_reason != reason:
                    updates_msg.append({"id": old_id, "reason": reason, "updated_at": today})
                    msg_updated += 1
            else:
                inserts.append({
                    "ticker":          ticker,
                    "warning_type":    warn_type,
                    "designated_date": today,
                    "is_active":       True,
                    "reason":          reason,
                })
                new_warnings += 1

        # 해소 처리
        for warn_type, (warn_id, _) in existing.items():
            if warn_type not in current_types:
                deactivations.append({"id": warn_id, "is_active": False,
                                      "release_date": today, "updated_at": today})
                released_count += 1

    # ── DB 반영 ──
    if inserts:
        log.info(f"  신규 경고 INSERT: {len(inserts)}건")
        for i in range(0, len(inserts), BATCH):
            try:
                sb.table("stock_warnings").upsert(inserts[i:i+BATCH],
                                                  on_conflict="ticker,warning_type").execute()
            except Exception as e:
                log.warning(f"  경고 insert 실패: {e}")
    for u in updates_msg:
        try:
            sb.table("stock_warnings").update(
                {"reason": u["reason"], "updated_at": u["updated_at"]}
            ).eq("id", u["id"]).execute()
        except Exception:
            pass
    for d in deactivations:
        try:
            sb.table("stock_warnings").update(
                {"is_active": False, "release_date": d["release_date"], "updated_at": d["updated_at"]}
            ).eq("id", d["id"]).execute()
        except Exception:
            pass

    log.info(f"STEP 3 완료: 신규 +{new_warnings}건 / 메시지 갱신 {msg_updated}건 / 해소 {released_count}건")


# ══════════════════════════════════════════════════════
# STEP 4: stocks 신규 상장 종목 추가
# ══════════════════════════════════════════════════════
def update_stock_list():
    log.info("=" * 60)
    log.info("STEP 4: stocks 신규 상장 종목 확인")

    try:
        from pykrx import stock as krx
    except ImportError:
        log.warning("  pykrx 없음 - 종목 리스트 업데이트 스킵")
        return

    existing = set(r["ticker"] for r in fetch_all("stocks", "ticker"))
    today_str = datetime.now().strftime("%Y%m%d")
    today_iso = datetime.now().strftime("%Y-%m-%d")
    new_records: list = []

    for market in ["KOSPI", "KOSDAQ"]:
        try:
            tickers = krx.get_market_ticker_list(today_str, market=market)
            for t in tickers:
                if t in existing:
                    continue
                try:
                    name = krx.get_market_ticker_name(t)
                except Exception:
                    name = ""
                new_records.append({
                    "ticker":       t,
                    "stock_name":   name,
                    "market":       market,
                    "listing_date": today_iso,
                })
                log.info(f"  신규 상장: {t} {name} ({market})")
            time.sleep(0.5)
        except Exception as e:
            log.warning(f"  {market} 종목 리스트 오류: {e}")

    if new_records:
        n = upsert_chunked("stocks", new_records, on_conflict="ticker")
        log.info(f"STEP 4 완료: 신규 종목 +{n}개")
    else:
        log.info("STEP 4 완료: 신규 상장 종목 없음")


# ══════════════════════════════════════════════════════
# 메인
# ══════════════════════════════════════════════════════
def main():
    import argparse
    parser = argparse.ArgumentParser(description="SafeInvest AI 일일 증분 업데이트 (Supabase)")
    parser.add_argument("--price-only", action="store_true", help="주가만 업데이트")
    parser.add_argument("--fin-only",   action="store_true", help="재무만 업데이트")
    parser.add_argument("--warn-only",  action="store_true", help="경고만 재계산")
    parser.add_argument("--no-fin",     action="store_true", help="재무 업데이트 제외")
    parser.add_argument("--no-quality", action="store_true", help="후속 quality check 생략")
    args = parser.parse_args()

    start = datetime.now()
    log.info("=" * 60)
    log.info(f"SafeInvest AI 증분 업데이트 시작: {start.strftime('%Y-%m-%d %H:%M:%S')}")
    log.info(f"Supabase URL: {SUPABASE_URL}")
    log.info("=" * 60)

    if args.price_only:
        update_prices()
    elif args.fin_only:
        update_financials()
    elif args.warn_only:
        update_warnings()
    else:
        update_stock_list()
        update_prices()
        if not args.no_fin:
            update_financials()
        update_warnings()

    if not args.no_quality:
        log.info("\n" + "=" * 60)
        log.info("증분 수집 완료 → 데이터 정합성 검사 자동 시작")
        log.info("=" * 60)
        import subprocess
        subprocess.run(
            [sys.executable, str(Path(__file__).parent / "data_quality_check.py")],
            cwd=str(Path(__file__).parent)
        )

    elapsed = (datetime.now() - start).seconds
    log.info("=" * 60)
    log.info(f"전체 완료: {elapsed // 60}분 {elapsed % 60}초 소요")
    log.info(f"로그 파일: {LOG_PATH}")


if __name__ == "__main__":
    main()
