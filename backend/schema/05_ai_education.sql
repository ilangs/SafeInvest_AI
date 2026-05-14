-- ════════════════════════════════════════════════════════════════════════════
-- SafeInvest AI — 배포 모듈 5 : AI & Education (AI 챗봇 + 교육 콘텐츠)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 📌 이 모듈이 하는 일
--   AI 챗봇과 교육센터(주디 백과사전·FSS·학습일기)가 사용하는 모든 테이블·함수.
--
--   [1] chat_history       : AI 챗봇 대화 기록
--   [2] knowledge_chunks   : RAG 문서 청크 (FSS · 자체 작성 콘텐츠)
--   [3] knowledge_embeddings : pgvector 1536차 임베딩
--   [4] match_knowledge    : 일반 RAG 검색 RPC (rag_chain.py 호출)
--   [5] fss_contents       : FSS 금감원 콘텐츠 메타
--   [6] match_knowledge_fss: FSS 전용 검색 RPC (chatbot_graph.py 호출)
--   [7] v_fss_ingest_status: FSS 적재 상태 점검 뷰
--   [8] stock_terms        : 주식 용어 백과사전 (230개)
--   [9] increment_view_count : 용어 조회수 증가 RPC
--   [10] study_logs        : 사용자 학습 일기
--
-- 📌 선행 조건
--   01_foundation.sql (vector, moddatetime 확장 + update_updated_at 함수)
--
-- 📌 정상 실행 확인
--   SELECT COUNT(*) FROM information_schema.tables
--    WHERE table_name IN ('chat_history','knowledge_chunks','knowledge_embeddings',
--                         'fss_contents','stock_terms','study_logs');
--   → 6 이어야 함
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- [1] chat_history : AI 챗봇 대화 기록
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    session_id  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_user
    ON chat_history(user_id, created_at DESC);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_read_self" ON chat_history;
CREATE POLICY "chat_read_self" ON chat_history
    FOR SELECT USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- [2] knowledge_chunks : RAG 문서 청크 (FSS + 자체 콘텐츠)
-- ════════════════════════════════════════════════════════════════════════════
-- 1개 원본 문서 → N개 청크로 분할 저장
-- metadata 예시 : { "contents_slno": "619", "category_code": "5003" }
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category    TEXT,
    title       TEXT,
    content     TEXT NOT NULL,
    source      TEXT,                            -- 'FSS' | 'manual' | ...
    source_url  TEXT,
    tags        TEXT[],
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_read" ON knowledge_chunks;
CREATE POLICY "knowledge_read" ON knowledge_chunks
    FOR SELECT USING (auth.role() = 'authenticated');

-- FSS 청크 효율 인덱스
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fss_slno
    ON knowledge_chunks ((metadata->>'contents_slno'))
    WHERE source = 'FSS';

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fss_category
    ON knowledge_chunks ((metadata->>'category_code'))
    WHERE source = 'FSS';


-- ════════════════════════════════════════════════════════════════════════════
-- [3] knowledge_embeddings : pgvector 1536차 임베딩
-- ════════════════════════════════════════════════════════════════════════════
-- OpenAI text-embedding-3-small (1536-dim) 결과 저장
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id    UUID NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    embedding   VECTOR(1536) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ivfflat : 근사 최근접 이웃 검색 인덱스 (수십만 벡터에서도 빠름)
CREATE INDEX IF NOT EXISTS idx_knowledge_vector
    ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "embeddings_read" ON knowledge_embeddings;
CREATE POLICY "embeddings_read" ON knowledge_embeddings
    FOR SELECT USING (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════════════════════════════════
-- [4] match_knowledge : 일반 RAG 검색 RPC
-- ════════════════════════════════════════════════════════════════════════════
-- backend/app/services/rag_chain.py 가 사용 (LCEL 단일 질의 체인)
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


-- ════════════════════════════════════════════════════════════════════════════
-- [5] fss_contents : FSS 금감원 콘텐츠 원본 메타
-- ════════════════════════════════════════════════════════════════════════════
-- knowledge_chunks 와 1:N 관계 (metadata.contents_slno 로 연결)
CREATE TABLE IF NOT EXISTS fss_contents (
    contents_slno        TEXT PRIMARY KEY,        -- FSS 원본 PK
    category_code        TEXT NOT NULL,           -- '2001', '5003' 등
    title                TEXT,
    edu_trgt_cntnt       TEXT,
    play_second          INT,
    fnc_engn_code        TEXT,
    make_type_code       TEXT,
    xtrnl_contents_url   TEXT,
    file_down_url        TEXT,
    book_reg_qnty        INT,
    book_aply_avlbl_yn   TEXT,
    cpyrht_perm_code     TEXT,
    cpyrht_perm_code_etc TEXT,
    producing_yr         TEXT,
    raw_html             TEXT,                    -- HTML 원문
    plain_text           TEXT,                    -- 정제된 텍스트
    char_count           INT,
    chunk_count          INT  DEFAULT 0,
    embedded_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fss_contents_category
    ON fss_contents (category_code);
CREATE INDEX IF NOT EXISTS idx_fss_contents_embedded
    ON fss_contents (embedded_at)
    WHERE embedded_at IS NULL;

DROP TRIGGER IF EXISTS trg_fss_contents_updated_at ON fss_contents;
CREATE TRIGGER trg_fss_contents_updated_at
    BEFORE UPDATE ON fss_contents
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE fss_contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fss_contents_read" ON fss_contents;
CREATE POLICY "fss_contents_read"
    ON fss_contents FOR SELECT
    USING (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════════════════════════════════
-- [6] match_knowledge_fss : FSS 전용 검색 RPC (카테고리 필터 지원)
-- ════════════════════════════════════════════════════════════════════════════
-- backend/app/services/chatbot_graph.py 의 retrieve 노드가 사용
CREATE OR REPLACE FUNCTION match_knowledge_fss(
    query_embedding VECTOR(1536),
    match_count     INT     DEFAULT 5,
    threshold       FLOAT   DEFAULT 0.3,
    category_codes  TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
    chunk_id      UUID,
    content       TEXT,
    title         TEXT,
    contents_slno TEXT,
    category_code TEXT,
    source_url    TEXT,
    similarity    FLOAT
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        kc.title,
        kc.metadata->>'contents_slno'   AS contents_slno,
        kc.metadata->>'category_code'   AS category_code,
        kc.source_url,
        1 - (ke.embedding <=> query_embedding) AS similarity
    FROM knowledge_embeddings ke
    JOIN knowledge_chunks     kc ON ke.chunk_id = kc.id
    WHERE kc.source = 'FSS'
      AND (1 - (ke.embedding <=> query_embedding)) >= threshold
      AND (
            category_codes IS NULL
         OR kc.metadata->>'category_code' = ANY(category_codes)
      )
    ORDER BY ke.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- [7] v_fss_ingest_status : FSS 적재 상태 점검 뷰
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_fss_ingest_status AS
SELECT
    fc.category_code,
    COUNT(*)                                           AS total_contents,
    COUNT(*) FILTER (WHERE fc.embedded_at IS NOT NULL) AS embedded_contents,
    COALESCE(SUM(fc.chunk_count), 0)                   AS total_chunks,
    MAX(fc.embedded_at)                                AS last_embedded_at
FROM fss_contents fc
GROUP BY fc.category_code
ORDER BY fc.category_code;


-- ════════════════════════════════════════════════════════════════════════════
-- [8] stock_terms : 주식 용어 백과사전 (230개)
-- ════════════════════════════════════════════════════════════════════════════
-- 프론트엔드 StockDictionary.jsx 가 직접 SELECT (RLS public_read)
CREATE TABLE IF NOT EXISTS stock_terms (
    id           TEXT PRIMARY KEY,               -- T001~T230
    term         TEXT NOT NULL,
    term_ko      TEXT,                           -- 영문 약어의 한국어 정식명
    category     TEXT NOT NULL,                  -- 17개 카테고리
    importance   SMALLINT DEFAULT 3
                 CHECK (importance BETWEEN 1 AND 5),
    initial_ko   TEXT,                           -- 초성 ㄱㄴㄷ... 또는 # (숫자/기타)
    initial_en   TEXT,                           -- A~Z
    tags         TEXT[]  DEFAULT '{}',
    related_ids  TEXT[]  DEFAULT '{}',
    description  TEXT    NOT NULL,
    easy_desc    TEXT,
    formula      TEXT,
    caution      TEXT,
    view_count   INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 검색·필터 성능
CREATE INDEX IF NOT EXISTS idx_terms_initial_ko
    ON stock_terms(initial_ko) WHERE initial_ko IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_terms_initial_en
    ON stock_terms(initial_en) WHERE initial_en IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_terms_category
    ON stock_terms(category);
CREATE INDEX IF NOT EXISTS idx_terms_importance
    ON stock_terms(importance DESC);

-- 전문 검색 GIN 인덱스 (term + term_ko + description 통합)
CREATE INDEX IF NOT EXISTS idx_terms_fts
    ON stock_terms
    USING GIN (
        to_tsvector('simple', term || ' ' || COALESCE(term_ko, '') || ' ' || description)
    );

-- 백과사전은 공개 콘텐츠 → 누구나 SELECT, 인증된 사용자만 쓰기
ALTER TABLE stock_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON stock_terms;
CREATE POLICY "public_read" ON stock_terms FOR SELECT USING (true);
DROP POLICY IF EXISTS "auth_write" ON stock_terms;
CREATE POLICY "auth_write"  ON stock_terms FOR ALL    USING (auth.role() = 'authenticated');


-- ════════════════════════════════════════════════════════════════════════════
-- [9] increment_view_count : 용어 조회수 증가 RPC
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_view_count(term_id TEXT)
RETURNS VOID AS $$
    UPDATE stock_terms
    SET view_count = view_count + 1,
        updated_at = NOW()
    WHERE id = term_id;
$$ LANGUAGE SQL;

-- stock_terms updated_at 자동 갱신 트리거
DROP TRIGGER IF EXISTS trg_stock_terms_updated ON stock_terms;
CREATE TRIGGER trg_stock_terms_updated
    BEFORE UPDATE ON stock_terms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- [10] study_logs : 사용자 학습 일기
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS study_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    content    TEXT         NOT NULL,
    tag        VARCHAR(50)  DEFAULT '학습기록',
    mood       VARCHAR(30)  DEFAULT '기록',
    ai_comment TEXT,
    log_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_logs_user_date
    ON study_logs (user_id, log_date DESC, created_at DESC);

ALTER TABLE study_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own study logs" ON study_logs;
CREATE POLICY "Users can manage own study logs"
    ON study_logs
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_study_logs_updated_at ON study_logs;
CREATE TRIGGER trg_study_logs_updated_at
    BEFORE UPDATE ON study_logs
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);


-- ── ✅ 완료 메시지 ───────────────────────────────────────────────────────────
SELECT 'AI & Education module installed: 6 tables + 3 RPC + 1 view' AS result;
