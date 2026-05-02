"""
analysis/migrate_to_supabase.py
────────────────────────────────
로컬 SQLite(phase1_stock_dataset.sqlite) → Supabase 마이그레이션.

실행 전 .env 또는 환경변수에 설정 필요:
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=...

실행:
  cd C:\\workAI\\TeamProject3\\safeInvest\\backend
  python analysis/migrate_to_supabase.py --table stocks
  python analysis/migrate_to_supabase.py --table prices
  python analysis/migrate_to_supabase.py --table financials
  python analysis/migrate_to_supabase.py --table warnings
  python analysis/migrate_to_supabase.py   ← 전체
"""

import os, math
import sys
import sqlite3
import argparse
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# ── 환경변수 로드 ──────────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "backend", ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정해 주세요.")
    sys.exit(1)

ROOT    = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "phase1_stock_dataset.sqlite")

if not os.path.exists(DB_PATH):
    print(f"❌ SQLite DB를 찾을 수 없습니다: {DB_PATH}")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ Supabase 실제 스키마 기준 매핑 (2025-05-02 확정)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# [1] stocks
#   SQLite  : ticker, name, market, sector, industry, listed_date
#   Supabase: ticker, stock_name, market, sector, industry, listing_date
STOCKS_TABLE   = "stocks"
STOCKS_COL_MAP = {
    "ticker"      : "ticker",
    "name"        : "stock_name",    # name → stock_name
    "market"      : "market",
    "sector"      : "sector",
    "industry"    : "industry",
    "listed_date" : "listing_date",  # listed_date → listing_date
}

# [2] stock_prices
#   SQLite  : ticker, date, open, high, low, close, volume
#   Supabase: ticker, trade_date, open_price, high_price, low_price, close_price, volume
PRICES_TABLE   = "stock_prices"
PRICES_COL_MAP = {
    "ticker": "ticker",
    "date"  : "trade_date",   # date → trade_date
    "open"  : "open_price",   # open → open_price
    "high"  : "high_price",   # high → high_price
    "low"   : "low_price",    # low  → low_price
    "close" : "close_price",  # close → close_price
    "volume": "volume",
}

# [3] stock_financials
#   SQLite  : ticker, year, quarter, revenue, operating_profit, net_profit,
#             total_assets(*없음), total_equity(*없음), total_liabilities(*없음),
#             debt_ratio, roe, capital_impairment
#   Supabase: ticker, fiscal_year, fiscal_quarter, revenue, operating_profit,
#             net_income, debt_ratio, roe, capital_impairment
#   ※ total_assets / total_equity / total_liabilities → Supabase에 없으므로 제외
FINANCIALS_TABLE   = "stock_financials"
FINANCIALS_COL_MAP = {
    "ticker"            : "ticker",
    "year"              : "fiscal_year",     # year → fiscal_year
    "quarter"           : "fiscal_quarter",  # quarter → fiscal_quarter
    "revenue"           : "revenue",
    "operating_profit"  : "operating_profit",
    "net_profit"        : "net_income",      # net_profit → net_income
    "debt_ratio"        : "debt_ratio",
    "roe"               : "roe",
    "capital_impairment": "capital_impairment",
    # total_assets / total_equity / total_liabilities 제외
}

# [4] stock_warnings
#   SQLite  : ticker, warning_type, designated_date, is_active, reason,
#             created_at, updated_at, release_date
#   Supabase: ticker, warning_type, designated_date, release_date, reason,
#             is_active, created_at, updated_at  ← 동일
WARNINGS_TABLE   = "stock_warnings"
WARNINGS_COL_MAP = {
    "ticker"          : "ticker",
    "warning_type"    : "warning_type",
    "designated_date" : "designated_date",
    "release_date"    : "release_date",
    "reason"          : "reason",
    "is_active"       : "is_active",
    "created_at"      : "created_at",
    "updated_at"      : "updated_at",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# ── 유틸 ──────────────────────────────────────────────────────────

def clean_df(df: pd.DataFrame) -> list[dict]:
    """NaN / inf → None 변환 후 dict 리스트 반환 (JSON 안전)."""
    records = df.to_dict("records")
    cleaned = []
    for row in records:
        clean_row = {}
        for k, v in row.items():
            if v is None:
                clean_row[k] = None
            elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean_row[k] = None  # float NaN / inf → None
            else:
                clean_row[k] = v
        cleaned.append(clean_row)
    return cleaned


def apply_col_map(df: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """존재하는 컬럼만 선택 후 Supabase 컬럼명으로 rename."""
    existing = {k: v for k, v in col_map.items() if k in df.columns}
    missing  = [k for k in col_map if k not in df.columns]
    if missing:
        print(f"  ℹ️  SQLite에 없는 컬럼 (무시): {missing}")
    return df[list(existing.keys())].rename(columns=existing)


def upsert_batch(table: str, records: list[dict], batch_size: int = 500) -> int:
    """배치 upsert. 성공 건수 반환."""
    total, success = len(records), 0
    for i in range(0, total, batch_size):
        batch = records[i: i + batch_size]
        try:
            supabase.table(table).upsert(batch).execute()
            success += len(batch)
            print(f"  [{table}] {success:,}/{total:,} ({success/total*100:.1f}%)", end="\r")
        except Exception as e:
            print(f"\n  ⚠️  {table} batch {i}~{i+len(batch)}: {e}")
    print(f"  [{table}] 완료 {success:,}/{total:,}" + " " * 20)
    return success


# ── 마이그레이션 함수 ──────────────────────────────────────────────

def migrate_stocks():
    print(f"\n▶ [1/4] {STOCKS_TABLE} (종목 기본정보)")
    conn = sqlite3.connect(DB_PATH)
    df   = pd.read_sql_query("SELECT * FROM stocks", conn)
    conn.close()

    df["ticker"] = df["ticker"].astype(str).str.zfill(6)
    df = apply_col_map(df, STOCKS_COL_MAP)

    print(f"  SQLite 행수: {len(df):,} / 전송 컬럼: {list(df.columns)}")
    return upsert_batch(STOCKS_TABLE, clean_df(df))


def migrate_prices():
    print(f"\n▶ [2/4] {PRICES_TABLE} (주가 OHLCV) — 대용량, 시간이 걸립니다...")
    conn = sqlite3.connect(DB_PATH)
    total_count = pd.read_sql_query(
        "SELECT COUNT(*) AS cnt FROM stock_prices", conn
    ).iloc[0]["cnt"]
    print(f"  총 {total_count:,}건 처리 예정")

    success = 0
    for chunk in pd.read_sql_query(
        "SELECT * FROM stock_prices ORDER BY ticker, date",
        conn,
        chunksize=5_000,
    ):
        chunk["ticker"] = chunk["ticker"].astype(str).str.zfill(6)
        chunk = apply_col_map(chunk, PRICES_COL_MAP)
        
        # ✅ float → int 변환 (SQLite float 저장값 → Supabase integer 타입)
        int_cols = ["open_price", "high_price", "low_price", "close_price", "volume"]
        for col in int_cols:
            if col in chunk.columns:
                chunk[col] = pd.to_numeric(chunk[col], errors="coerce").fillna(0).astype(int)
      
        success += upsert_batch(PRICES_TABLE, clean_df(chunk), batch_size=500)

    conn.close()
    return success


def migrate_financials():
    print(f"\n▶ [3/4] {FINANCIALS_TABLE} (재무제표)")
    conn = sqlite3.connect(DB_PATH)
    df   = pd.read_sql_query("SELECT * FROM stock_financials", conn)
    conn.close()

    df["ticker"] = df["ticker"].astype(str).str.zfill(6)

    if "capital_impairment" in df.columns:
        df["capital_impairment"] = df["capital_impairment"].fillna(0).astype(bool)
    else:
        df["capital_impairment"] = False

    df = apply_col_map(df, FINANCIALS_COL_MAP)

    print(f"  SQLite 행수: {len(df):,} / 전송 컬럼: {list(df.columns)}")

    # ✅ pandas dtype 우회 — records 단계에서 직접 타입 변환
    bigint_cols = ["revenue", "operating_profit", "net_income"]
    records = clean_df(df)  # NaN → None 처리
    for row in records:
        for col in bigint_cols:
            if col in row:
                val = row[col]
                try:
                    # str/float 모두 처리: "9500.0" → float → int
                    row[col] = int(float(str(val))) if val is not None else None
                except (ValueError, TypeError):
                    row[col] = None

    return upsert_batch(FINANCIALS_TABLE, records)


def migrate_warnings():
    print(f"\n▶ [4/4] {WARNINGS_TABLE} (위험 경고)")
    conn = sqlite3.connect(DB_PATH)
    df   = pd.read_sql_query("SELECT * FROM stock_warnings", conn)
    conn.close()

    df["ticker"] = df["ticker"].astype(str).str.zfill(6)

    # is_active: SQLite int(0/1) → Supabase boolean
    if "is_active" in df.columns:
        df["is_active"] = df["is_active"].fillna(0).astype(bool)

    df = apply_col_map(df, WARNINGS_COL_MAP)

    records      = clean_df(df)
    total, success = len(records), 0

    for i in range(0, total, 200):
        batch = records[i: i + 200]
        try:
            supabase.table(WARNINGS_TABLE).upsert(
                batch, on_conflict="ticker,warning_type"
            ).execute()
            success += len(batch)
            print(f"  [{WARNINGS_TABLE}] {success:,}/{total:,}", end="\r")
        except Exception as e:
            print(f"\n  ⚠️  batch {i}: {e}")

    print(f"  [{WARNINGS_TABLE}] 완료 {success:,}/{total:,}" + " " * 20)
    return success


# ── 메인 ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SQLite → Supabase 마이그레이션")
    parser.add_argument(
        "--table",
        choices=["stocks", "prices", "financials", "warnings"],
        help="마이그레이션할 테이블 (미지정 시 전체)",
    )
    args = parser.parse_args()

    start = datetime.now()
    print("=" * 60)
    print("  SafeInvest AI  —  SQLite → Supabase 마이그레이션")
    print(f"  시작: {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  DB  : {DB_PATH}")
    print("=" * 60)

    t = args.table
    if not t or t == "stocks":     migrate_stocks()
    if not t or t == "prices":     migrate_prices()
    if not t or t == "financials": migrate_financials()
    if not t or t == "warnings":   migrate_warnings()

    elapsed = (datetime.now() - start).total_seconds()
    print(f"\n✅ 마이그레이션 완료 (소요: {elapsed:.1f}초)")
