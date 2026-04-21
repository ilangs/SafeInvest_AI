-- ============================================================
-- SafeInvest AI — 마이그레이션 SQL (v1 → v2)
-- ============================================================
-- 기존 knowledge_chunks 테이블이 있을 경우 사용하는 마이그레이션입니다.
-- Supabase Dashboard → SQL Editor 에서 실행하세요.
--
-- 처음부터 새로 시작하는 경우: schema/init.sql v2.0 을 실행하세요.
-- ============================================================

-- ── 신규 테이블 추가 ──────────────────────────────────────

-- 관심종목
CREATE TABLE IF NOT EXISTS watchlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_code  TEXT NOT NULL,
    stock_name  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, stock_code)
);

-- 종목 기본정보
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

-- 위험 신호
CREATE TABLE IF NOT EXISTS risk_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code  TEXT NOT NULL REFERENCES stock_companies(stock_code),
    flag_type   TEXT NOT NULL,
    severity    TEXT CHECK (severity IN ('high','medium','low')),
    flag_detail TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── knowledge_chunks 컬럼 추가 (기존 테이블 유지) ─────────

ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS category   TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS title      TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS source     TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS tags       TEXT[];

-- ── 신규 인덱스 추가 ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_watchlist_user
    ON watchlist(user_id);

CREATE INDEX IF NOT EXISTS idx_risk_active
    ON risk_flags(stock_code) WHERE is_active = TRUE;

-- 기존 idx 이름 충돌 방지 (v1에서 idx_knowledge_embeddings_vector 였음)
CREATE INDEX IF NOT EXISTS idx_knowledge_vector
    ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ── RLS 정책 추가 ─────────────────────────────────────────

ALTER TABLE watchlist       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags      ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "watchlist_self" ON watchlist USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "stocks_read" ON stock_companies FOR SELECT USING (auth.role()='authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "risks_read" ON risk_flags FOR SELECT USING (auth.role()='authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── match_knowledge RPC 함수 교체 (threshold, source_url 추가) ──

CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding VECTOR(1536),
    match_count     INT   DEFAULT 5,
    threshold       FLOAT DEFAULT 0.78,
    filter          JSONB DEFAULT '{}'
)
RETURNS TABLE (
    id         UUID,
    chunk_id   UUID,
    content    TEXT,
    metadata   JSONB,
    source     TEXT,
    source_url TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT ke.id, ke.chunk_id, kc.content, kc.metadata,
           kc.source, kc.source_url,
           1 - (ke.embedding <=> query_embedding) AS similarity
    FROM knowledge_embeddings ke
    JOIN knowledge_chunks kc ON ke.chunk_id = kc.id
    WHERE (1 - (ke.embedding <=> query_embedding)) >= threshold
      AND kc.metadata @> filter
    ORDER BY ke.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
