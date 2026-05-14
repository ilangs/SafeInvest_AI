-- ════════════════════════════════════════════════════════════════════════════
-- SafeInvest AI — 배포 모듈 4 : Market Analysis (시장분석 데이터)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 📌 이 모듈이 하는 일
--   시장분석(/analysis) 페이지가 사용하는 핵심 데이터 + 데이터 품질검증 인프라.
--
--   [1] 종목 마스터 4테이블 : stocks / stock_prices / stock_financials / stock_warnings
--   [1-extra] 레거시 호환 : stock_companies / risk_flags (seed 스크립트 호환)
--   [2] 사용자 부가 테이블 : recent_searches (최근 조회)
--   [3] 운영 로그 : data_collection_log (일일 수집 결과)
--   [4] 품질검증 : data_quality_reports / data_quality_items
--   [5] 품질검증 함수 : qc_check_duplicates / qc_check_orphan_tickers / qc_null_summary
--
-- 📌 데이터 출처
--   - stocks         : KRX 종목 마스터 (analysis/daily_update.py STEP 4)
--   - stock_prices   : KIS API 일별 OHLCV (STEP 1)
--   - stock_financials : DART OpenAPI 분기 재무 (STEP 2)
--   - stock_warnings : 자동 계산 (STEP 3) — 자본잠식·연속적자·고부채·매출부족
--
-- 📌 선행 조건
--   01_foundation.sql
--
-- 📌 정상 실행 확인
--   SELECT COUNT(*) FROM information_schema.tables
--    WHERE table_name IN ('stocks','stock_prices','stock_financials',
--                         'stock_warnings','recent_searches',
--                         'data_collection_log','data_quality_reports','data_quality_items');
--   → 8 이어야 함
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- [1] 종목 마스터 4테이블
-- ════════════════════════════════════════════════════════════════════════════

-- ── stocks : 종목 기본정보 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stocks (
    ticker        TEXT PRIMARY KEY,             -- 6자리 종목코드
    stock_name    TEXT,                          -- 종목명
    market        TEXT,                          -- 'KOSPI' | 'KOSDAQ'
    sector        TEXT,                          -- 섹터 (예: '제조업')
    industry      TEXT,                          -- 산업 (예: 'IT·서비스')
    listing_date  TEXT,                          -- 상장일 (YYYY-MM-DD)
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── stock_prices : 일별 OHLCV ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_prices (
    ticker       TEXT NOT NULL,
    trade_date   TEXT NOT NULL,                  -- YYYY-MM-DD
    open_price   BIGINT,
    high_price   BIGINT,
    low_price    BIGINT,
    close_price  BIGINT,
    volume       BIGINT,
    amount       TEXT,
    PRIMARY KEY (ticker, trade_date)
);

-- ── stock_financials : 분기·연간 재무제표 ──────────────────────────────────
-- total_assets / total_equity / total_liabilities : BS(재무상태표) 핵심
-- data_source : 'DART' | 'KIS' | 'manual'
CREATE TABLE IF NOT EXISTS stock_financials (
    ticker              TEXT NOT NULL,
    fiscal_year         TEXT NOT NULL,           -- '2024'
    fiscal_quarter      TEXT NOT NULL,           -- 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'A'
    revenue             BIGINT,                  -- 매출액
    operating_profit    BIGINT,                  -- 영업이익
    net_income          BIGINT,                  -- 당기순이익
    total_assets        BIGINT,                  -- 총자산
    total_equity        BIGINT,                  -- 자기자본
    total_liabilities   BIGINT,                  -- 부채총계
    debt_ratio          REAL,                    -- 부채비율 (%)
    roe                 REAL,                    -- 자기자본이익률 (%)
    capital_impairment  BOOLEAN DEFAULT FALSE,   -- 자본잠식 여부
    data_source         TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ticker, fiscal_year, fiscal_quarter)
);

-- ── stock_warnings : 위험 신호 ──────────────────────────────────────────────
-- 4가지 warning_type : CAPITAL_IMPAIRMENT / CONTINUOUS_LOSS / HIGH_DEBT / LOW_REVENUE
CREATE TABLE IF NOT EXISTS stock_warnings (
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


-- ════════════════════════════════════════════════════════════════════════════
-- [1-extra] 레거시 종목 테이블 (seed_stock_data.py 호환용)
-- ════════════════════════════════════════════════════════════════════════════
-- 활성 데이터 경로는 stocks/stock_warnings 사용. 다만 scripts/seed_stock_data.py
-- 가 stock_companies 에 INSERT 하므로 테이블 정의는 유지.
-- 향후 seed 코드 정리 시 함께 삭제 가능.

CREATE TABLE IF NOT EXISTS stock_companies (
    stock_code       TEXT PRIMARY KEY,
    stock_name       TEXT NOT NULL,
    market           TEXT CHECK (market IN ('KOSPI','KOSDAQ')),
    sector           TEXT,
    business_summary TEXT,
    per              NUMERIC,
    pbr              NUMERIC,
    div_yield        NUMERIC,
    market_cap       BIGINT,
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code  TEXT NOT NULL REFERENCES stock_companies(stock_code),
    flag_type   TEXT NOT NULL,
    severity    TEXT CHECK (severity IN ('high','medium','low')),
    flag_detail TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_active
    ON risk_flags(stock_code) WHERE is_active = TRUE;

ALTER TABLE stock_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stocks_read" ON stock_companies;
CREATE POLICY "stocks_read" ON stock_companies
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "risks_read" ON risk_flags;
CREATE POLICY "risks_read" ON risk_flags
    FOR SELECT USING (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════════════════════════════════
-- [2] 사용자 부가 : 최근 조회 종목
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS recent_searches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    ticker      TEXT NOT NULL,
    searched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, ticker)
);


-- ════════════════════════════════════════════════════════════════════════════
-- [3] 운영 로그 : 일일 수집 결과
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS data_collection_log (
    id               BIGSERIAL PRIMARY KEY,
    collection_type  TEXT NOT NULL,    -- 'stocks' | 'prices' | 'warnings' | 'financials'
    status           TEXT NOT NULL,    -- 'success' | 'partial' | 'error'
    total_count      INTEGER DEFAULT 0,
    success_count    INTEGER DEFAULT 0,
    fail_count       INTEGER DEFAULT 0,
    error_message    TEXT,
    started_at       TIMESTAMPTZ,
    finished_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════════════════
-- [4] 데이터 품질 검증 : 보고서 + 항목
-- ════════════════════════════════════════════════════════════════════════════
-- analysis/data_quality_check.py 가 일일 수집 후 자동 호출되어 결과를 적재
CREATE TABLE IF NOT EXISTS data_quality_reports (
    id                 BIGSERIAL PRIMARY KEY,
    report_date        TEXT UNIQUE NOT NULL,        -- YYYY-MM-DD
    run_at             TEXT,
    overall_grade      TEXT,                         -- PASS | WARN | FAIL
    pass_count         INTEGER DEFAULT 0,
    warn_count         INTEGER DEFAULT 0,
    fail_count         INTEGER DEFAULT 0,
    total_count        INTEGER DEFAULT 0,
    price_rows         BIGINT,
    fin_rows           BIGINT,
    warning_rows       BIGINT,
    today_price_cnt    INTEGER,
    latest_price_date  TEXT,
    detail_json        JSONB,
    summary_text       TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_quality_items (
    id            BIGSERIAL PRIMARY KEY,
    report_id     BIGINT REFERENCES data_quality_reports(id) ON DELETE CASCADE,
    check_group   TEXT NOT NULL,                    -- 'CHECK1_증분유입'
    check_name    TEXT NOT NULL,
    grade         TEXT NOT NULL,                    -- PASS | WARN | FAIL
    message       TEXT,
    detail        TEXT
);


-- ════════════════════════════════════════════════════════════════════════════
-- [5] 인덱스
-- ════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker
    ON stock_prices (ticker);
CREATE INDEX IF NOT EXISTS idx_stock_prices_date
    ON stock_prices (trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_financials_ticker
    ON stock_financials (ticker);
CREATE INDEX IF NOT EXISTS idx_stock_warnings_ticker
    ON stock_warnings (ticker);
CREATE INDEX IF NOT EXISTS idx_recent_searches_user
    ON recent_searches (user_id, searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_log_type
    ON data_collection_log (collection_type, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_dqr_date
    ON data_quality_reports (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_dqi_report
    ON data_quality_items (report_id);


-- ════════════════════════════════════════════════════════════════════════════
-- [6] Row Level Security
-- ════════════════════════════════════════════════════════════════════════════
-- 시장 데이터는 인증된 사용자 누구나 조회 가능 (쓰기는 service_role 만)
ALTER TABLE stocks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_financials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_warnings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_searches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_items    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_stocks" ON stocks;
CREATE POLICY "auth_read_stocks" ON stocks
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_read_prices" ON stock_prices;
CREATE POLICY "auth_read_prices" ON stock_prices
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_read_financials" ON stock_financials;
CREATE POLICY "auth_read_financials" ON stock_financials
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "auth_read_warnings" ON stock_warnings;
CREATE POLICY "auth_read_warnings" ON stock_warnings
    FOR SELECT USING (auth.role() = 'authenticated');

-- recent_searches : 자기 데이터만 CRUD
DROP POLICY IF EXISTS "own_recent_all" ON recent_searches;
CREATE POLICY "own_recent_all" ON recent_searches
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- data_quality_* : 정책 미지정 → service_role 만 접근 가능 (RLS 우회)


-- ════════════════════════════════════════════════════════════════════════════
-- [7] 품질 검증 함수 (Supabase RPC)
-- ════════════════════════════════════════════════════════════════════════════
-- data_quality_check.py 가 풀 스캔 대신 이 함수들을 호출 → 네트워크/메모리 절약

-- qc_check_duplicates : PK 중복 검증
CREATE OR REPLACE FUNCTION qc_check_duplicates()
RETURNS TABLE (
    table_name    TEXT,
    total_rows    BIGINT,
    distinct_rows BIGINT,
    dup_count     BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'stock_prices'::TEXT,
           COUNT(*)::BIGINT,
           COUNT(DISTINCT (ticker, trade_date))::BIGINT,
           (COUNT(*) - COUNT(DISTINCT (ticker, trade_date)))::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_financials'::TEXT,
           COUNT(*)::BIGINT,
           COUNT(DISTINCT (ticker, fiscal_year, fiscal_quarter))::BIGINT,
           (COUNT(*) - COUNT(DISTINCT (ticker, fiscal_year, fiscal_quarter)))::BIGINT
      FROM stock_financials;
END;
$$ LANGUAGE plpgsql STABLE;

-- qc_check_orphan_tickers : 참조 무결성 검증
CREATE OR REPLACE FUNCTION qc_check_orphan_tickers()
RETURNS TABLE (
    issue_type   TEXT,
    orphan_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'prices_orphan'::TEXT,
           COUNT(DISTINCT p.ticker)::BIGINT
      FROM stock_prices p
      LEFT JOIN stocks s ON p.ticker = s.ticker
      WHERE s.ticker IS NULL
    UNION ALL
    SELECT 'financials_orphan'::TEXT,
           COUNT(DISTINCT f.ticker)::BIGINT
      FROM stock_financials f
      LEFT JOIN stocks s ON f.ticker = s.ticker
      WHERE s.ticker IS NULL
    UNION ALL
    SELECT 'warnings_orphan'::TEXT,
           COUNT(DISTINCT w.ticker)::BIGINT
      FROM stock_warnings w
      LEFT JOIN stocks s ON w.ticker = s.ticker
      WHERE s.ticker IS NULL
    UNION ALL
    SELECT 'no_price_stocks'::TEXT,
           COUNT(*)::BIGINT
      FROM stocks s
      LEFT JOIN stock_prices p ON s.ticker = p.ticker
      WHERE p.ticker IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- qc_null_summary : NULL 값 카운트 (data_quality_check.py 가 호출)
CREATE OR REPLACE FUNCTION qc_null_summary()
RETURNS TABLE (
    table_name TEXT,
    col_name   TEXT,
    null_cnt   BIGINT,
    total_cnt  BIGINT
) AS $$
BEGIN
    RETURN QUERY
    -- stock_prices 핵심 5컬럼
    SELECT 'stock_prices'::TEXT, 'open_price'::TEXT,
           COUNT(*) FILTER (WHERE open_price  IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'high_price',
           COUNT(*) FILTER (WHERE high_price  IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'low_price',
           COUNT(*) FILTER (WHERE low_price   IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'close_price',
           COUNT(*) FILTER (WHERE close_price IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'volume',
           COUNT(*) FILTER (WHERE volume      IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    -- stock_financials 핵심 6컬럼
    UNION ALL
    SELECT 'stock_financials', 'revenue',
           COUNT(*) FILTER (WHERE revenue          IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'operating_profit',
           COUNT(*) FILTER (WHERE operating_profit IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'net_income',
           COUNT(*) FILTER (WHERE net_income       IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'total_assets',
           COUNT(*) FILTER (WHERE total_assets     IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'total_equity',
           COUNT(*) FILTER (WHERE total_equity     IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'roe',
           COUNT(*) FILTER (WHERE roe              IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials;
END;
$$ LANGUAGE plpgsql STABLE;

-- 권한 부여
GRANT EXECUTE ON FUNCTION qc_check_duplicates()     TO service_role;
GRANT EXECUTE ON FUNCTION qc_check_orphan_tickers() TO service_role;
GRANT EXECUTE ON FUNCTION qc_null_summary()         TO service_role;


-- ── ✅ 완료 메시지 ───────────────────────────────────────────────────────────
SELECT 'Market Analysis module installed: 8 tables + 3 QC functions' AS result;
