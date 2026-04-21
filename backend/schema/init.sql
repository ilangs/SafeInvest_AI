-- ============================================================
-- SafeInvest AI — init.sql v2.0 (축소 확정본)
-- ============================================================
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → 이 파일 전체 붙여넣기 → Run
--
-- ⚠️  주의사항:
--   - 이 파일은 Backend 담당(오케스트레이터)이 관리합니다.
--   - DB 담당은 이 파일을 수령하여 실행만 합니다.
--   - 임의로 테이블명/컬럼명을 변경하지 마세요.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. 사용자 프로필
CREATE TABLE IF NOT EXISTS user_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname    TEXT,
    risk_level  TEXT DEFAULT 'moderate'
                     CHECK (risk_level IN ('conservative','moderate','aggressive')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 대시보드 위젯 설정
CREATE TABLE IF NOT EXISTS user_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    layout_json JSONB DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI 상담 이력
CREATE TABLE IF NOT EXISTS chat_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    session_id  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 관심종목
CREATE TABLE IF NOT EXISTS watchlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_code  TEXT NOT NULL,
    stock_name  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, stock_code)
);

-- 5. 종목 기본정보 + 위험신호 통합
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

-- 6. 위험 신호
CREATE TABLE IF NOT EXISTS risk_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code  TEXT NOT NULL REFERENCES stock_companies(stock_code),
    flag_type   TEXT NOT NULL,
    severity    TEXT CHECK (severity IN ('high','medium','low')),
    flag_detail TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 교육 콘텐츠 (RAG 원본)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category    TEXT,
    title       TEXT,
    content     TEXT NOT NULL,
    source      TEXT,
    source_url  TEXT,
    tags        TEXT[],
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 벡터 임베딩
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id    UUID NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    embedding   VECTOR(1536) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 인덱스 ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_knowledge_vector
    ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_chat_user
    ON chat_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watchlist_user
    ON watchlist(user_id);

CREATE INDEX IF NOT EXISTS idx_risk_active
    ON risk_flags(stock_code) WHERE is_active = TRUE;

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_companies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self"    ON user_profiles    USING (auth.uid() = id);
CREATE POLICY "settings_self"    ON user_settings    USING (auth.uid() = user_id);
CREATE POLICY "chat_read_self"   ON chat_history     FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlist_self"   ON watchlist        USING (auth.uid() = user_id);
CREATE POLICY "stocks_read"      ON stock_companies  FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "risks_read"       ON risk_flags       FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "knowledge_read"   ON knowledge_chunks FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "embeddings_read"  ON knowledge_embeddings FOR SELECT USING (auth.role()='authenticated');

-- ── pgvector RPC 함수 ─────────────────────────────────────
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

-- ── 신규 가입 시 user_profiles 자동 생성 ──────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id)
    VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── updated_at 자동 갱신 트리거 ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
