-- ─────────────────────────────────────────────────────────────────
-- migration_06_data_quality_and_extend_financials.sql
--
-- 1) stock_financials 테이블에 BS(재무상태표) 핵심 컬럼 + 출처 추가
--    daily_update.py 의 NaN catch-up · 회계 항등식 검증 · 자본잠식 판정 지원
-- 2) data_quality_reports / data_quality_items 테이블 신설
--    data_quality_check.py 결과 영구 저장
-- ─────────────────────────────────────────────────────────────────

-- (1) stock_financials 컬럼 확장
ALTER TABLE stock_financials
  ADD COLUMN IF NOT EXISTS total_assets       BIGINT,
  ADD COLUMN IF NOT EXISTS total_equity       BIGINT,
  ADD COLUMN IF NOT EXISTS total_liabilities  BIGINT,
  ADD COLUMN IF NOT EXISTS data_source        TEXT;

-- (2) 데이터 품질 보고서 헤더
CREATE TABLE IF NOT EXISTS data_quality_reports (
  id                 BIGSERIAL PRIMARY KEY,
  report_date        TEXT UNIQUE NOT NULL,        -- YYYY-MM-DD
  run_at             TEXT,                         -- YYYY-MM-DD HH:MM:SS
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

CREATE INDEX IF NOT EXISTS idx_dqr_date
  ON data_quality_reports (report_date DESC);

-- (3) 데이터 품질 보고서 상세 항목
CREATE TABLE IF NOT EXISTS data_quality_items (
  id            BIGSERIAL PRIMARY KEY,
  report_id     BIGINT REFERENCES data_quality_reports(id) ON DELETE CASCADE,
  check_group   TEXT NOT NULL,                    -- e.g. "CHECK1_증분유입"
  check_name    TEXT NOT NULL,                    -- e.g. "증분유입_주가"
  grade         TEXT NOT NULL,                    -- PASS | WARN | FAIL
  message       TEXT,
  detail        TEXT
);

CREATE INDEX IF NOT EXISTS idx_dqi_report
  ON data_quality_items (report_id);

-- (4) RLS — 관리자 전용 (service_role 만 접근 가능)
ALTER TABLE data_quality_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_items   ENABLE ROW LEVEL SECURITY;
-- 정책 생략 → service_role 만 RLS 우회 접근 가능
