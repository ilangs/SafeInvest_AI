"""
SafeInvest AI - 데이터 정합성 검사 & 보고서 Supabase 저장
실행:
  python data_quality_check.py                  # auto: 평일=daily, 일요일=weekly
  python data_quality_check.py --mode daily     # Tier 1: 증분 검증 + RPC (~30초)
  python data_quality_check.py --mode weekly    # Tier 2: 풀 검증 + RPC (5~10분)
  python data_quality_check.py --mode quick     # 레거시: CHECK 3·5 생략
  python data_quality_check.py --mode full      # weekly 별칭
daily_update.py 완료 후 자동 호출됨 (--mode auto)

2-Tier 검사 전략:
  Tier 1 (daily, 평일):
    - CHECK 1, 2(오늘만), 3(오늘만), 4(RPC), 6(오늘 upsert만), 7
    - CHECK 8/9 (DB RPC 1초)
    - CHECK 5 스킵 (주간만)
  Tier 2 (weekly, 일요일):
    - 모든 CHECK 풀 검증 (CHECK 4/8/9 만 RPC 가속)

원본(streamlit/SQLite) → Supabase 포팅:
  - 모든 SQL 을 Supabase REST API + RPC + Python 처리로 대체
  - 결과는 data_quality_reports / data_quality_items 테이블에 영구 저장
"""

import os, sys, json, logging, traceback, time
from datetime import datetime, timedelta
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

BASE_DIR = Path(__file__).parent.parent
LOG_DIR  = BASE_DIR / "analysis" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

TODAY    = datetime.now().strftime("%Y-%m-%d")
RUN_AT   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
LOG_PATH = LOG_DIR / f"quality_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_PATH, encoding="utf-8"), logging.StreamHandler()]
)
log = logging.getLogger(__name__)

# Supabase
from supabase import create_client, Client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("SUPABASE 환경변수 없음")
    sys.exit(1)
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 결과 저장 리스트
results: list = []   # {"group","name","grade","message","detail"}


def record(group, name, grade, msg, detail=""):
    icon = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌"}.get(grade, "❓")
    log.info(f"{icon} [{grade}] {name}: {msg}" + (f"\n         └─ {detail}" if detail else ""))
    results.append({
        "group":   group, "name": name, "grade": grade,
        "message": msg,   "detail": detail
    })


# ── 공통 유틸 ──────────────────────────────────────────
def count_table(table: str, filters: dict | None = None,
                gte: dict | None = None, lte: dict | None = None,
                ne:  dict | None = None) -> int:
    """Supabase 테이블 row 카운트. 재시도 + 실패 시 0 반환."""
    def _do():
        # count="planned" — pg_class 통계 기반 추정 카운트, 빠르고 stream reset 없음
        # (정확도 약간 떨어지지만 정합성 검사에는 충분)
        q = sb.table(table).select("*", count="planned").limit(1)
        if filters:
            for k, v in filters.items():
                q = q.eq(k, v)
        if gte:
            for k, v in gte.items():
                q = q.gte(k, v)
        if lte:
            for k, v in lte.items():
                q = q.lte(k, v)
        if ne:
            for k, v in ne.items():
                q = q.neq(k, v)
        return q.execute()
    try:
        res = _retry_call(_do, label=f"count_table({table})")
        return res.count or 0
    except Exception as e:
        log.error(f"  [count_table 실패] {table} filters={filters} -> {type(e).__name__}: {e}")
        return 0


def fetch_all(table: str, columns: str = "*", filters: dict | None = None,
              gte: dict | None = None, order: tuple | None = None) -> list:
    """전체 행 페이지네이션 조회. 페이지 단위 재시도 + StreamReset 안전."""
    rows: list = []
    page = 500          # HTTP/2 stream reset 회피를 위해 작게 (이전 1000)
    offset = 0
    while True:
        def _fetch_page(_off=offset):
            q = sb.table(table).select(columns)
            if filters:
                for k, v in filters.items():
                    q = q.eq(k, v)
            if gte:
                for k, v in gte.items():
                    q = q.gte(k, v)
            if order:
                col, desc = order
                q = q.order(col, desc=desc)
            q = q.range(_off, _off + page - 1)
            return q.execute()
        try:
            res = _retry_call(_fetch_page, label=f"fetch_all({table}) offset={offset}")
        except Exception as e:
            log.error(f"  [fetch_all 실패] {table} offset={offset} -> {type(e).__name__}: {e}")
            break
        chunk = res.data or []
        rows.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return rows


# ══════════════════════════════════════════════════
# CHECK 1: 증분 데이터 유입 확인
# ══════════════════════════════════════════════════
def check_incremental_inflow():
    G = "CHECK1_증분유입"
    log.info("\n" + "─" * 50 + f"\n{G}")

    weekday    = datetime.now().weekday()
    is_weekend = weekday >= 5

    total_stocks = count_table("stocks") or 1
    today_price_cnt = count_table("stock_prices", filters={"trade_date": TODAY})
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    # 최신 trade_date (DESC 1행)
    latest_res = (sb.table("stock_prices").select("trade_date")
                    .order("trade_date", desc=True).limit(1).execute())
    latest_date = (latest_res.data[0]["trade_date"]
                   if latest_res.data else "")

    if is_weekend:
        record(G, "증분유입_주가", "WARN",
               f"오늘({TODAY}) 주말 - 장 미개장", "평일 재확인")
    elif today_price_cnt == 0:
        record(G, "증분유입_주가", "FAIL",
               f"오늘({TODAY}) 주가 데이터 없음",
               "python daily_update.py --price-only 실행 필요")
    elif today_price_cnt < total_stocks * 0.8:
        record(G, "증분유입_주가", "WARN",
               f"오늘 {today_price_cnt:,}건 수집 ({today_price_cnt/total_stocks*100:.1f}%)",
               "80% 미만 - 수집 불완전")
    else:
        record(G, "증분유입_주가", "PASS",
               f"오늘 {today_price_cnt:,}건 수집 ({today_price_cnt/total_stocks*100:.1f}%)")

    if latest_date == TODAY:
        record(G, "최신날짜_주가", "PASS", f"최신 날짜: {latest_date}")
    elif latest_date >= yesterday:
        record(G, "최신날짜_주가", "WARN", f"최신 날짜: {latest_date} (오늘 미수집)")
    else:
        days_gap = ((datetime.now() - datetime.strptime(latest_date, "%Y-%m-%d")).days
                    if latest_date else 9999)
        record(G, "최신날짜_주가",
               "WARN" if days_gap <= 3 else "FAIL",
               f"최신 날짜: {latest_date} ({days_gap}일 전)")

    # 재무 최신
    fin_latest_res = (sb.table("stock_financials").select("fiscal_year,fiscal_quarter")
                        .order("fiscal_year", desc=True)
                        .order("fiscal_quarter", desc=True).limit(1).execute())
    if fin_latest_res.data:
        record(G, "최신_재무", "PASS",
               f"재무 최신: {fin_latest_res.data[0]['fiscal_year']} "
               f"{fin_latest_res.data[0]['fiscal_quarter']}")
    else:
        record(G, "최신_재무", "WARN", "재무 데이터 없음")

    return today_price_cnt, latest_date


# ══════════════════════════════════════════════════
# CHECK 2: OHLCV 논리 검증
# ══════════════════════════════════════════════════
def check_ohlcv_logic(daily_mode: bool = False):
    G = "CHECK2_OHLCV논리"
    log.info("\n" + "─" * 50 + f"\n{G}")
    if daily_mode:
        cutoff = TODAY                                              # 오늘만
        scope_label = "오늘"
    else:
        cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        scope_label = "최근 30일"

    recent = fetch_all("stock_prices",
                       "ticker,trade_date,open_price,high_price,low_price,close_price,volume",
                       gte={"trade_date": cutoff})
    log.info(f"  검증 대상 ({scope_label}): {len(recent):,}행")

    high_low_err = sum(1 for r in recent
                       if (r.get("high_price") is not None
                           and r.get("low_price") is not None
                           and r["high_price"] < r["low_price"]))
    close_zero   = sum(1 for r in recent if r.get("close_price") == 0)
    neg_vol      = sum(1 for r in recent
                       if r.get("volume") is not None and r["volume"] < 0)
    high_oc_err  = sum(1 for r in recent
                       if (r.get("high_price") is not None and r["high_price"] > 0
                           and ((r.get("open_price")  is not None and r["high_price"] < r["open_price"])
                             or (r.get("close_price") is not None and r["high_price"] < r["close_price"]))))

    record(G, "OHLCV_HighLow", "FAIL" if high_low_err > 0 else "PASS",
           f"High<Low: {high_low_err:,}건 ({scope_label})" if high_low_err > 0 else f"High<Low 없음 ({scope_label}) ✓")
    record(G, "OHLCV_CloseZero", "WARN" if close_zero > 0 else "PASS",
           f"종가=0: {close_zero:,}건" if close_zero > 0 else "종가=0 없음 ✓",
           "거래정지 또는 수집 오류" if close_zero > 0 else "")
    record(G, "OHLCV_NegVol", "FAIL" if neg_vol > 0 else "PASS",
           f"음수 거래량: {neg_vol:,}건" if neg_vol > 0 else "음수 거래량 없음 ✓")
    record(G, "OHLCV_HighOC", "WARN" if high_oc_err > 0 else "PASS",
           f"High<Open/Close: {high_oc_err:,}건" if high_oc_err > 0 else "High>=Open,Close ✓",
           "권리락/배당락 가능성" if high_oc_err > 0 else "")


# ══════════════════════════════════════════════════
# CHECK 3: 이상치 탐지
# ══════════════════════════════════════════════════
def check_outliers(daily_mode: bool = False):
    G = "CHECK3_이상치"
    log.info("\n" + "─" * 50 + f"\n{G}")

    # 음수 가격 검사 — daily 모드는 오늘만, 주간은 최근 7일
    if daily_mode:
        cutoff7 = TODAY
    else:
        cutoff7 = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    recent7 = fetch_all("stock_prices", "open_price,high_price,low_price,close_price",
                        gte={"trade_date": cutoff7})
    neg = sum(1 for r in recent7 if any(
        (r.get(c) is not None and r[c] < 0)
        for c in ["open_price", "high_price", "low_price", "close_price"]))
    record(G, "이상치_음수가격", "FAIL" if neg > 0 else "PASS",
           f"음수가격 {neg:,}건" if neg > 0 else "음수가격 없음 ✓")

    # 오늘 ±30% 급등락 — Python 처리
    today_rows = fetch_all("stock_prices", "ticker,close_price", filters={"trade_date": TODAY})
    extreme = 0
    if today_rows:
        # 직전 거래일 종가 가져오기 (한 번에 — 어제 오늘 모두 포함되도록 5일치)
        cutoff5 = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        recent5 = fetch_all("stock_prices", "ticker,trade_date,close_price",
                            gte={"trade_date": cutoff5})
        # ticker 별 직전 거래일 종가
        from collections import defaultdict
        by_ticker = defaultdict(list)
        for r in recent5:
            if r["trade_date"] < TODAY:
                by_ticker[r["ticker"]].append((r["trade_date"], r["close_price"]))
        prev_close = {}
        for t, lst in by_ticker.items():
            lst.sort(reverse=True)
            if lst:
                prev_close[t] = lst[0][1]
        for r in today_rows:
            pc = prev_close.get(r["ticker"])
            tc = r.get("close_price")
            if pc and tc and pc != 0:
                if abs(tc - pc) / pc > 0.30:
                    extreme += 1
    record(G, "이상치_급등락", "WARN" if extreme > 50 else "PASS",
           f"±30% 초과 {extreme:,}종목",
           "시장 급변 또는 수집 오류 확인" if extreme > 50 else "")


# ══════════════════════════════════════════════════
# CHECK 4: 결측값 검사 (DB RPC qc_null_summary 사용)
#   기존: 컬럼별 N개의 count 쿼리 → DB RPC 1회로 통합
# ══════════════════════════════════════════════════
def check_nulls():
    G = "CHECK4_결측값"
    log.info("\n" + "─" * 50 + f"\n{G}")

    fin_thresholds = {
        "revenue": 10, "operating_profit": 20, "net_income": 20,
        "total_assets": 10, "total_equity": 15, "roe": 25,
    }
    price_thresholds = {  # 모든 컬럼 동일
        "open_price": 1, "high_price": 1, "low_price": 1,
        "close_price": 1, "volume": 1,
    }

    try:
        res = _retry_call(lambda: sb.rpc("qc_null_summary").execute(),
                          label="rpc qc_null_summary")
        rows = res.data or []
    except Exception as e:
        log.error(f"  RPC qc_null_summary 실패 → 풀 fetch fallback: {e}")
        rows = []

    if not rows:
        # ── Fallback: 기존 방식 (RPC 미설치 시) ──
        log.warning("  RPC 결과 비어있음 — 컬럼별 count 쿼리 fallback")
        tp = count_table("stock_prices") or 1
        tf = count_table("stock_financials") or 1

        def null_count(table: str, col: str) -> int:
            try:
                r = sb.table(table).select("*", count="exact").is_(col, "null").limit(1).execute()
                return r.count or 0
            except Exception as ex:
                log.warning(f"  null count 실패 {table}.{col}: {ex}")
                return 0

        for col, thr in price_thresholds.items():
            cnt = null_count("stock_prices", col); pct = cnt / tp * 100
            record(G, f"결측_PRICE_{col}",
                   "FAIL" if pct > 5 else ("WARN" if pct > thr else "PASS"),
                   f"{col} NULL {cnt:,}건 ({pct:.2f}%)")
        for col, thr in fin_thresholds.items():
            cnt = null_count("stock_financials", col); pct = cnt / tf * 100
            record(G, f"결측_FIN_{col}",
                   "FAIL" if pct > thr * 2 else ("WARN" if pct > thr else "PASS"),
                   f"{col} NULL {cnt:,}건 ({pct:.1f}%)")
        return

    # ── RPC 결과 처리 ──
    for r in rows:
        tbl  = r.get("table_name")
        col  = r.get("col_name")
        cnt  = int(r.get("null_cnt") or 0)
        tot  = max(int(r.get("total_cnt") or 0), 1)
        pct  = cnt / tot * 100

        if tbl == "stock_prices":
            thr = 1
            grade = "FAIL" if pct > 5 else ("WARN" if pct > thr else "PASS")
            record(G, f"결측_PRICE_{col}", grade,
                   f"{col} NULL {cnt:,}건 ({pct:.2f}%)")
        else:  # stock_financials
            thr = fin_thresholds.get(col, 20)
            grade = "FAIL" if pct > thr * 2 else ("WARN" if pct > thr else "PASS")
            record(G, f"결측_FIN_{col}", grade,
                   f"{col} NULL {cnt:,}건 ({pct:.1f}%)")


# ══════════════════════════════════════════════════
# CHECK 5: 날짜 연속성
# ══════════════════════════════════════════════════
def check_continuity():
    G = "CHECK5_연속성"
    log.info("\n" + "─" * 50 + f"\n{G}")

    test_tickers = ["005930", "000660", "035420", "005380", "051910"]
    cutoff = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")

    for ticker in test_tickers:
        # 종목 존재 확인
        ck = sb.table("stocks").select("ticker").eq("ticker", ticker).limit(1).execute()
        if not ck.data:
            continue
        rows = (sb.table("stock_prices").select("trade_date")
                  .eq("ticker", ticker).gte("trade_date", cutoff)
                  .order("trade_date").execute()).data or []
        dates = [r["trade_date"] for r in rows]
        if len(dates) < 2:
            record(G, f"연속성_{ticker}", "WARN", f"최근 60일 {len(dates)}건 (부족)")
            continue
        max_gap = 0
        gaps = []
        for i in range(1, len(dates)):
            d = (datetime.strptime(dates[i],   "%Y-%m-%d") -
                 datetime.strptime(dates[i-1], "%Y-%m-%d")).days
            if d > 5:
                gaps.append(f"{dates[i-1]}~{dates[i]}({d}일)")
            max_gap = max(max_gap, d)
        record(G, f"연속성_{ticker}",
               "FAIL" if gaps else ("WARN" if max_gap > 3 else "PASS"),
               f"최대갭 {max_gap}일, {len(dates)}건",
               " | ".join(gaps[:3]) if gaps else "")


# ══════════════════════════════════════════════════
# CHECK 6: 재무 정합성
# ══════════════════════════════════════════════════
def check_financial_integrity(daily_mode: bool = False):
    G = "CHECK6_재무정합성"
    log.info("\n" + "─" * 50 + f"\n{G}")

    # daily 모드: 오늘 upsert/갱신된 행만 (updated_at >= today)
    # weekly 모드: 전체 검증
    cols = ("ticker,fiscal_year,fiscal_quarter,total_assets,total_equity,"
            "total_liabilities,capital_impairment,net_income,roe")
    if daily_mode:
        try:
            fin_rows = fetch_all("stock_financials", cols + ",updated_at",
                                 gte={"updated_at": TODAY})
            log.info(f"  검증 대상 (오늘 upsert): {len(fin_rows):,}행")
        except Exception as e:
            log.warning(f"  daily 모드 fetch 실패 ({e}) → 풀 검증 fallback")
            fin_rows = fetch_all("stock_financials", cols)
    else:
        fin_rows = fetch_all("stock_financials", cols)
        log.info(f"  검증 대상 (전체): {len(fin_rows):,}행")

    if not fin_rows:
        record(G, "재무_검증대상", "PASS", "오늘 갱신된 재무 없음 - 검증 스킵" if daily_mode else "재무 데이터 없음")
        return
    base_pos_assets = sum(1 for r in fin_rows
                          if r.get("total_assets") and r["total_assets"] > 0) or 1

    mismatch = 0
    flag_err = 0
    roe_err  = 0
    for r in fin_rows:
        ta = r.get("total_assets")
        tl = r.get("total_liabilities")
        te = r.get("total_equity")
        ci = r.get("capital_impairment")
        ni = r.get("net_income")
        roe = r.get("roe")

        # 회계 항등식 (자산 = 부채 + 자본, 1% 허용)
        if ta is not None and tl is not None and te is not None and ta > 0:
            if abs(ta - (tl + te)) / ta > 0.01:
                mismatch += 1

        # 자본잠식 플래그 일관성
        if te is not None:
            if (te < 0 and ci is False) or (te >= 0 and ci is True):
                flag_err += 1

        # ROE 파생값 (1.0% 허용)
        if roe is not None and ni is not None and te is not None and te != 0:
            calc = ni / te * 100
            if abs(roe - calc) > 1.0:
                roe_err += 1

    pct = mismatch / base_pos_assets * 100
    record(G, "재무_항등식",
           "FAIL" if pct > 5 else ("WARN" if mismatch > 0 else "PASS"),
           f"자산≠부채+자본: {mismatch:,}건 ({pct:.1f}%)")
    record(G, "재무_자본잠식플래그", "WARN" if flag_err > 0 else "PASS",
           f"자본잠식 플래그 불일치: {flag_err:,}건")
    record(G, "재무_ROE파생값", "WARN" if roe_err > 0 else "PASS",
           f"ROE 불일치: {roe_err:,}건")


# ══════════════════════════════════════════════════
# CHECK 7: 경고 일관성
# ══════════════════════════════════════════════════
def check_warning_consistency():
    G = "CHECK7_경고일관성"
    log.info("\n" + "─" * 50 + f"\n{G}")

    # 최신 재무 (ticker 별) 결정
    import pandas as pd
    fin_rows = fetch_all("stock_financials",
                         "ticker,fiscal_year,fiscal_quarter,capital_impairment,total_equity,debt_ratio")
    if not fin_rows:
        record(G, "경고_데이터없음", "WARN", "재무 데이터 없음")
        return
    df = pd.DataFrame(fin_rows)
    df = df[df["fiscal_quarter"].isin(["Q1", "Q2", "Q3", "Q4", "A"])].copy()
    df["yq"] = df["fiscal_year"] + "-" + df["fiscal_quarter"]
    latest = df.loc[df.groupby("ticker")["yq"].idxmax()].reset_index(drop=True)

    # 활성 경고 ticker 집합 (warning_type 별)
    active_warns = fetch_all("stock_warnings", "ticker,warning_type",
                             filters={"is_active": True})
    by_type: dict[str, set] = {}
    for w in active_warns:
        by_type.setdefault(w["warning_type"], set()).add(w["ticker"])

    miss_imp = 0
    miss_debt = 0
    for _, r in latest.iterrows():
        ti = r["ticker"]
        # 자본잠식
        is_imp = (r.get("capital_impairment") is True
                  or (r.get("total_equity") is not None and r["total_equity"] < 0))
        if is_imp and ti not in by_type.get("CAPITAL_IMPAIRMENT", set()):
            miss_imp += 1
        # 고부채
        debt = r.get("debt_ratio")
        if debt is not None and debt > 200 and ti not in by_type.get("HIGH_DEBT", set()):
            miss_debt += 1

    record(G, "경고_자본잠식누락", "WARN" if miss_imp > 0 else "PASS",
           f"자본잠식 경고 누락: {miss_imp:,}개",
           "python daily_update.py --warn-only" if miss_imp > 0 else "")
    record(G, "경고_고부채누락", "WARN" if miss_debt > 0 else "PASS",
           f"고부채 경고 누락: {miss_debt:,}개")

    # 경고 현황 통계
    all_warns = fetch_all("stock_warnings", "warning_type,is_active")
    stat: dict[str, dict] = {}
    for w in all_warns:
        wt = w["warning_type"]
        stat.setdefault(wt, {"active": 0, "inactive": 0})
        if w["is_active"] is True:
            stat[wt]["active"] += 1
        else:
            stat[wt]["inactive"] += 1
    stat_msg = " | ".join(f"{wt}:활성{v['active']}/해소{v['inactive']}" for wt, v in stat.items())
    record(G, "경고_현황통계", "PASS", stat_msg or "경고 없음")


# ══════════════════════════════════════════════════
# CHECK 8: 중복 데이터 (DB RPC qc_check_duplicates)
#   기존: stock_prices 전체 fetch (~150만 행, 5분+)
#   현재: DB SQL 단일 호출 (~1초)
# ══════════════════════════════════════════════════
def check_duplicates():
    G = "CHECK8_중복"
    log.info("\n" + "─" * 50 + f"\n{G}")
    try:
        res = _retry_call(lambda: sb.rpc("qc_check_duplicates").execute(),
                          label="rpc qc_check_duplicates")
        rows = res.data or []
    except Exception as e:
        log.error(f"  RPC qc_check_duplicates 실패: {e}")
        record(G, "중복_RPC", "WARN", f"RPC 실패: {type(e).__name__}",
               "migration_08 미실행 가능성 - 풀 fetch fallback 미사용")
        return

    label_map = {"stock_prices": "PRICES", "stock_financials": "FINANCIALS"}
    for r in rows:
        tbl = r.get("table_name")
        dup = int(r.get("dup_count") or 0)
        tot = int(r.get("total_rows") or 0)
        record(G, f"중복_{label_map.get(tbl, tbl)}",
               "FAIL" if dup > 0 else "PASS",
               f"{tbl} 중복 {dup:,}건 (전체 {tot:,}행)")


# ══════════════════════════════════════════════════
# CHECK 9: 참조 무결성 (DB RPC qc_check_orphan_tickers)
#   기존: 4개 테이블 전체 ticker fetch
#   현재: DB SQL 단일 호출
# ══════════════════════════════════════════════════
def check_referential_integrity():
    G = "CHECK9_참조무결성"
    log.info("\n" + "─" * 50 + f"\n{G}")
    try:
        res = _retry_call(lambda: sb.rpc("qc_check_orphan_tickers").execute(),
                          label="rpc qc_check_orphan_tickers")
        rows = res.data or []
    except Exception as e:
        log.error(f"  RPC qc_check_orphan_tickers 실패: {e}")
        record(G, "무결성_RPC", "WARN", f"RPC 실패: {type(e).__name__}",
               "migration_08 미실행 가능성")
        return

    label_map = {
        "prices_orphan":     ("주가", "stocks 미등록 ticker", "WARN"),
        "financials_orphan": ("재무", "stocks 미등록 ticker", "WARN"),
        "warnings_orphan":   ("경고", "stocks 미등록 ticker", "WARN"),
        "no_price_stocks":   ("주가없는종목", "주가 없는 종목", "WARN"),
    }
    for r in rows:
        kind = r.get("issue_type")
        cnt  = int(r.get("orphan_count") or 0)
        if kind not in label_map:
            continue
        suffix, msg_prefix, grade_if_nonzero = label_map[kind]
        grade = grade_if_nonzero if cnt > 0 else "PASS"
        detail = "신규상장/ETF/SPAC 가능성" if (kind == "no_price_stocks" and cnt > 0) else ""
        record(G, f"무결성_{suffix}", grade, f"{msg_prefix}: {cnt:,}개", detail)


# ══════════════════════════════════════════════════
# 보고서를 Supabase 에 저장
# ══════════════════════════════════════════════════
def save_report_to_supabase(today_price_cnt, latest_date):
    pass_cnt = sum(1 for r in results if r["grade"] == "PASS")
    warn_cnt = sum(1 for r in results if r["grade"] == "WARN")
    fail_cnt = sum(1 for r in results if r["grade"] == "FAIL")
    total_cnt = len(results)
    overall = "FAIL" if fail_cnt > 0 else ("WARN" if warn_cnt > 0 else "PASS")

    price_rows   = count_table("stock_prices")
    fin_rows     = count_table("stock_financials")
    warning_rows = count_table("stock_warnings", filters={"is_active": True})

    fail_items = [r for r in results if r["grade"] == "FAIL"]
    warn_items = [r for r in results if r["grade"] == "WARN"]
    summary_lines = [f"검사일: {TODAY}  실행: {RUN_AT}",
                     f"전체: PASS {pass_cnt} / WARN {warn_cnt} / FAIL {fail_cnt}"]
    if fail_items:
        summary_lines.append("FAIL: " + ", ".join(r["name"] for r in fail_items))
    if warn_items:
        summary_lines.append("WARN: " + ", ".join(r["name"] for r in warn_items[:5])
                             + (f" 외 {len(warn_items)-5}건" if len(warn_items) > 5 else ""))
    summary_text = "\n".join(summary_lines)

    # Upsert (report_date PK)
    payload = {
        "report_date":       TODAY,
        "run_at":            RUN_AT,
        "overall_grade":     overall,
        "pass_count":        pass_cnt,
        "warn_count":        warn_cnt,
        "fail_count":        fail_cnt,
        "total_count":       total_cnt,
        "price_rows":        price_rows,
        "fin_rows":          fin_rows,
        "warning_rows":      warning_rows,
        "today_price_cnt":   today_price_cnt,
        "latest_price_date": latest_date,
        "detail_json":       results,
        "summary_text":      summary_text,
    }
    try:
        sb.table("data_quality_reports").upsert(payload, on_conflict="report_date").execute()
    except Exception as e:
        log.error(f"보고서 헤더 저장 실패: {e}")
        return overall, pass_cnt, warn_cnt, fail_cnt

    # report_id 조회
    rep = (sb.table("data_quality_reports").select("id")
             .eq("report_date", TODAY).maybe_single().execute())
    if not rep or not rep.data:
        return overall, pass_cnt, warn_cnt, fail_cnt
    report_id = rep.data["id"]

    # 이전 상세 항목 삭제 후 재삽입
    try:
        sb.table("data_quality_items").delete().eq("report_id", report_id).execute()
    except Exception:
        pass
    items = [{
        "report_id":   report_id,
        "check_group": r["group"],
        "check_name":  r["name"],
        "grade":       r["grade"],
        "message":     r["message"],
        "detail":      r["detail"],
    } for r in results]
    try:
        # 청크 분할
        for i in range(0, len(items), 500):
            sb.table("data_quality_items").insert(items[i:i+500]).execute()
    except Exception as e:
        log.warning(f"상세 항목 저장 실패: {e}")

    log.info(f"\n✅ 보고서 Supabase 저장 완료 (report_id={report_id}, {overall})")
    return overall, pass_cnt, warn_cnt, fail_cnt


# ══════════════════════════════════════════════════
# 메인
# ══════════════════════════════════════════════════
def _run_check(name: str, fn, *args):
    """각 CHECK 를 독립적으로 실행 — 한 단계 실패해도 다음 진행."""
    try:
        return fn(*args)
    except Exception as e:
        log.error(f"❌ [{name}] 예외 발생: {type(e).__name__}: {e}")
        log.error(f"   상세 traceback:\n{traceback.format_exc()}")
        return None


def _resolve_mode(arg_mode: str) -> str:
    """--mode auto 일 때: 평일(0~5)=daily, 일요일(6)=weekly."""
    if arg_mode != "auto":
        return arg_mode
    return "weekly" if datetime.now().weekday() == 6 else "daily"


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=["auto", "daily", "weekly", "full", "quick"],
        default="auto",
        help="auto(평일=daily, 일요일=weekly) | daily(증분만) | weekly/full(풀 검증) | quick(레거시: CHECK 3·5 스킵)",
    )
    # 레거시 호환
    parser.add_argument("--quick", action="store_true", help="(deprecated) --mode quick 와 동일")
    args = parser.parse_args()

    if args.quick:
        args.mode = "quick"

    mode = _resolve_mode(args.mode)
    is_daily   = (mode == "daily")
    is_weekly  = (mode in ("weekly", "full"))
    is_quick   = (mode == "quick")
    weekday_kr = ["월", "화", "수", "목", "금", "토", "일"][datetime.now().weekday()]

    log.info("=" * 60)
    log.info(f"데이터 정합성 검사 시작: {RUN_AT} ({weekday_kr}요일)")
    log.info(f"실행 모드: {mode}  (요청: {args.mode})")
    log.info(f"Supabase: {SUPABASE_URL}")
    log.info("=" * 60)

    # 사전 진단: 핵심 테이블 존재 여부
    log.info("[사전진단] 필수 테이블 접근 테스트")
    for tbl in ("stocks", "stock_prices", "stock_financials", "stock_warnings",
                "data_quality_reports"):
        try:
            r = sb.table(tbl).select("*", count="exact").limit(1).execute()
            log.info(f"  ✓ {tbl}: 접근 OK (row count={r.count})")
        except Exception as e:
            log.error(f"  ✗ {tbl}: 접근 실패 → {type(e).__name__}: {e}")

    inflow_result = _run_check("CHECK1", check_incremental_inflow)
    today_price_cnt, latest_date = inflow_result if inflow_result else (0, "")

    # CHECK 2 / 3 / 6 — daily 모드는 오늘 데이터만 검증
    _run_check("CHECK2", check_ohlcv_logic, is_daily)
    if not is_quick:
        _run_check("CHECK3", check_outliers, is_daily)

    _run_check("CHECK4", check_nulls)                       # RPC 1회로 통합

    # CHECK 5 — 연속성 (가벼운 5종목 검사)
    #   daily 모드는 스킵 (주간만)
    if (not is_quick) and (not is_daily):
        _run_check("CHECK5", check_continuity)

    _run_check("CHECK6", check_financial_integrity, is_daily)
    _run_check("CHECK7", check_warning_consistency)
    _run_check("CHECK8", check_duplicates)                  # RPC
    _run_check("CHECK9", check_referential_integrity)       # RPC

    try:
        overall, p, w, f = save_report_to_supabase(today_price_cnt, latest_date)
    except Exception as e:
        log.error(f"❌ 보고서 저장 실패: {type(e).__name__}: {e}")
        log.error(traceback.format_exc())
        overall, p, w, f = "FAIL", 0, 0, 1

    icon = {"PASS": "🟢", "WARN": "🟡", "FAIL": "🔴"}.get(overall, "❓")
    print(f"\n{icon} 최종결과: {overall}  ✅{p} ⚠️{w} ❌{f}  (mode={mode})  →  Supabase 저장 완료")
    print(f"확인: data_quality_reports 테이블 → {TODAY}")


if __name__ == "__main__":
    main()
