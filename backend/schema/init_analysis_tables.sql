-- ══════════════════════════════════════════════════════════════════
-- SafeInvest AI  —  Analysis Module  Supabase 스키마
-- Supabase SQL Editor 에서 실행하세요.
-- ══════════════════════════════════════════════════════════════════

-- 1. 종목 기본정보
CREATE TABLE IF NOT EXISTS stocks (
  ticker        TEXT PRIMARY KEY,          -- 6자리 종목코드
  name          TEXT,                      -- 종목명
  market        TEXT,                      -- KOSPI / KOSDAQ
  sector        TEXT,                      -- 업종
  industry      TEXT,                      -- 산업
  listed_date   TEXT,                      -- 상장일 (YYYY-MM-DD)
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 일별 주가 (OHLCV)  — 기술지표는 API 에서 계산
CREATE TABLE IF NOT EXISTS stock_prices (
  ticker   TEXT    NOT NULL,
  date     TEXT    NOT NULL,               -- YYYY-MM-DD
  open     REAL,
  high     REAL,
  low      REAL,
  close    REAL,
  volume   BIGINT,
  amount   TEXT,
  PRIMARY KEY (ticker, date)
);

-- 3. 재무제표 (분기·연간)
CREATE TABLE IF NOT EXISTS stock_financials (
  ticker              TEXT    NOT NULL,
  year                TEXT    NOT NULL,    -- '2023', '2024' ...
  quarter             TEXT    NOT NULL,    -- 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'A'
  revenue             REAL,               -- 매출액 (원)
  operating_profit    REAL,               -- 영업이익
  net_profit          REAL,               -- 순이익
  total_assets        REAL,               -- 총자산
  total_equity        REAL,               -- 자기자본
  total_liabilities   REAL,               -- 부채총계
  debt_ratio          REAL,               -- 부채비율 (%)
  roe                 REAL,               -- 자기자본이익률 (%)
  capital_impairment  INTEGER DEFAULT 0,  -- 자본잠식 여부 (0/1)
  data_source         TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, year, quarter)
);

-- 4. 위험 경고
CREATE TABLE IF NOT EXISTS stock_warnings (
  id               BIGSERIAL PRIMARY KEY,
  ticker           TEXT    NOT NULL,
  warning_type     TEXT    NOT NULL,       -- CAPITAL_IMPAIRMENT | CONTINUOUS_LOSS | HIGH_DEBT | LOW_REVENUE
  designated_date  TEXT,                   -- 경고 지정일
  is_active        INTEGER DEFAULT 1,      -- 1=활성, 0=해제
  reason           TEXT,                   -- 경고 사유
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  release_date     TEXT,                   -- 해제일
  UNIQUE (ticker, warning_type)
);

-- 5. 사용자별 최근 검색 종목
CREATE TABLE IF NOT EXISTS recent_searches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  ticker      TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);

-- ── 성능 인덱스 ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker       ON stock_prices (ticker);
CREATE INDEX IF NOT EXISTS idx_stock_prices_date         ON stock_prices (date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_financials_ticker   ON stock_financials (ticker);
CREATE INDEX IF NOT EXISTS idx_stock_warnings_ticker     ON stock_warnings (ticker);
CREATE INDEX IF NOT EXISTS idx_recent_searches_user      ON recent_searches (user_id, searched_at DESC);

-- ── RLS (Row Level Security) ───────────────────────────────────────
-- stocks / stock_prices / stock_financials / stock_warnings: 인증된 사용자 읽기 허용
ALTER TABLE stocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_warnings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_searches  ENABLE ROW LEVEL SECURITY;

-- 읽기 정책: 로그인한 사용자 전체 허용 (주가 데이터는 공개)
CREATE POLICY "auth_read_stocks"      ON stocks           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_prices"      ON stock_prices     FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_financials"  ON stock_financials FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_warnings"    ON stock_warnings   FOR SELECT USING (auth.role() = 'authenticated');

-- recent_searches: 자신의 데이터만 CRUD
CREATE POLICY "own_recent_select" ON recent_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_recent_insert" ON recent_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_recent_delete" ON recent_searches FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "own_recent_update" ON recent_searches FOR UPDATE USING (auth.uid() = user_id);
