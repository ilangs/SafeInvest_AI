-- migration_02: recent_searches 테이블 추가
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS recent_searches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  ticker      TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_recent_searches_user
  ON recent_searches (user_id, searched_at DESC);

ALTER TABLE recent_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_recent_select" ON recent_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_recent_insert" ON recent_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_recent_delete" ON recent_searches FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "own_recent_update" ON recent_searches FOR UPDATE USING (auth.uid() = user_id);
