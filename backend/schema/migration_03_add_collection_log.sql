-- migration_03: data_collection_log 테이블 추가
-- 일별 수집 Cron Job 실행 결과를 기록합니다.
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS data_collection_log (
  id               BIGSERIAL PRIMARY KEY,
  collection_type  TEXT NOT NULL,      -- 'stocks' | 'prices' | 'warnings' | 'financials'
  status           TEXT NOT NULL,      -- 'success' | 'partial' | 'error'
  total_count      INTEGER DEFAULT 0,
  success_count    INTEGER DEFAULT 0,
  fail_count       INTEGER DEFAULT 0,
  error_message    TEXT,
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_log_type
  ON data_collection_log (collection_type, finished_at DESC);
