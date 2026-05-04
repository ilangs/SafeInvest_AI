-- 모든 테이블 삭제 (주의: 데이터가 삭제됩니다) -> Table 재생성
DROP TABLE IF EXISTS data_collection_log, recent_searches, stock_warnings, stock_financials, stock_prices, stocks;

-- [1] stocks
CREATE TABLE stocks (
  ticker        TEXT PRIMARY KEY,
  stock_name    TEXT,
  market        TEXT,
  sector        TEXT,
  industry      TEXT,
  listing_date  TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- [2] stock_prices
CREATE TABLE stock_prices (
  ticker       TEXT NOT NULL,
  trade_date   TEXT NOT NULL,
  open_price   BIGINT,
  high_price   BIGINT,
  low_price    BIGINT,
  close_price  BIGINT,
  volume       BIGINT,
  amount       TEXT,
  PRIMARY KEY (ticker, trade_date)
);

-- [3] stock_financials
CREATE TABLE stock_financials (
  ticker              TEXT NOT NULL,
  fiscal_year         TEXT NOT NULL,
  fiscal_quarter      TEXT NOT NULL,
  revenue             BIGINT,
  operating_profit    BIGINT,
  net_income          BIGINT,
  debt_ratio          REAL,
  roe                 REAL,
  capital_impairment  BOOLEAN DEFAULT FALSE,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, fiscal_year, fiscal_quarter)
);

-- [4] stock_warnings
CREATE TABLE stock_warnings (
  id               BIGSERIAL PRIMARY KEY,
  ticker           TEXT NOT NULL,
  warning_type     TEXT NOT NULL,
  designated_date  TEXT,
  release_date     TEXT,
  reason           TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ticker, warning_type)
);

-- [5] data_collection_log
CREATE TABLE data_collection_log (
  id               BIGSERIAL PRIMARY KEY,
  collection_type  TEXT NOT NULL,
  status           TEXT NOT NULL,
  total_count      INTEGER DEFAULT 0,
  success_count    INTEGER DEFAULT 0,
  fail_count       INTEGER DEFAULT 0,
  error_message    TEXT,
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ DEFAULT NOW()
);

-- [6] 최근 검색 종목 테이블 생성
CREATE TABLE IF NOT EXISTS recent_searches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,            -- Supabase Auth 사용자 ID
  ticker      TEXT NOT NULL,            -- 종목 코드
  searched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, ticker)              -- 한 사용자가 같은 종목을 중복 저장하지 않도록 설정
);

-- 인덱스: 사용자별 최신순 정렬 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_recent_searches_user_date 
  ON recent_searches (user_id, searched_at DESC);

-- RLS 설정
ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;

-- 정책: 자신의 검색 기록만 관리
CREATE POLICY "Users can manage their own recent searches"
  ON recent_searches
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 외래키 연결 (필요 시): stocks 테이블의 ticker와 연결하여 데이터 무결성 강화
-- ALTER TABLE recent_searches 
--   ADD CONSTRAINT fk_recent_searches_ticker 
--   FOREIGN KEY (ticker) REFERENCES stocks(ticker);