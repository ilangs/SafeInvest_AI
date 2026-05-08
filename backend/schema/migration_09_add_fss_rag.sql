-- migration_09_add_fss_rag.sql
-- 금감원(FSS) 금융교육 콘텐츠 RAG 적재용 마이그레이션
--
-- 설계 원칙
--   - 검색 인터페이스(knowledge_chunks / knowledge_embeddings / match_knowledge)는 재사용
--   - FSS 원본 메타는 별도 테이블(fss_contents)에 보관하여 출처 복원/표시에 사용
--   - knowledge_chunks.metadata.contents_slno 로 FSS 원본 1:N 연결
--   - 기존 RAG 흐름(rag_chain.ask)은 무수정으로 FSS 청크까지 자연 검색됨

-- ── 0. 확장 ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- ── 1. FSS 원본 메타 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fss_contents (
    contents_slno       TEXT PRIMARY KEY,        -- FSS 원본 PK
    category_code       TEXT NOT NULL,           -- '2001', '2002', ...
    title               TEXT,
    edu_trgt_cntnt      TEXT,                    -- 대상 (Y, AM 등)
    play_second         INT,                     -- 영상 길이(초)
    fnc_engn_code       TEXT,
    make_type_code      TEXT,
    xtrnl_contents_url  TEXT,
    file_down_url       TEXT,
    book_reg_qnty       INT,
    book_aply_avlbl_yn  TEXT,
    cpyrht_perm_code    TEXT,
    cpyrht_perm_code_etc TEXT,
    producing_yr        TEXT,
    raw_html            TEXT,                    -- cntnt 원문(HTML)
    plain_text          TEXT,                    -- 정제된 plain text (참고/재청킹용)
    char_count          INT,
    chunk_count         INT  DEFAULT 0,          -- 생성된 청크 수
    embedded_at         TIMESTAMPTZ,             -- 임베딩 완료 시각 (NULL = 미완료)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fss_contents_category
    ON fss_contents (category_code);

CREATE INDEX IF NOT EXISTS idx_fss_contents_embedded
    ON fss_contents (embedded_at)
    WHERE embedded_at IS NULL;

CREATE TRIGGER trg_fss_contents_updated_at
    BEFORE UPDATE ON fss_contents
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ── 2. knowledge_chunks 보조 인덱스 (FSS 청크 재청킹/삭제 효율) ───────────────
-- knowledge_chunks.metadata 에 { "contents_slno": "...", "category_code": "..." } 저장됨
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fss_slno
    ON knowledge_chunks ((metadata->>'contents_slno'))
    WHERE source = 'FSS';

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fss_category
    ON knowledge_chunks ((metadata->>'category_code'))
    WHERE source = 'FSS';

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE fss_contents ENABLE ROW LEVEL SECURITY;

-- 인증 사용자는 메타 조회 가능 (출처 카드 노출용)
CREATE POLICY "fss_contents_read"
    ON fss_contents FOR SELECT
    USING (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE 는 service_role 만 (시드 스크립트 전용)
-- service_role 은 RLS 우회하므로 별도 정책 불필요

-- ── 4. FSS 전용 검색 RPC (선택: 카테고리 필터를 더 자연스럽게) ────────────────
-- 기존 match_knowledge 로도 동작하지만, FSS 카테고리 필터 사용 빈도가 높을 것을
-- 가정하여 helper RPC 제공. LangGraph 에서 카테고리 라우팅 시 사용.
CREATE OR REPLACE FUNCTION match_knowledge_fss(
    query_embedding VECTOR(1536),
    match_count     INT     DEFAULT 5,
    threshold       FLOAT   DEFAULT 0.3,
    category_codes  TEXT[]  DEFAULT NULL   -- e.g. ARRAY['2001','2002'] / NULL = 전체
)
RETURNS TABLE (
    chunk_id        UUID,
    content         TEXT,
    title           TEXT,
    contents_slno   TEXT,
    category_code   TEXT,
    source_url      TEXT,
    similarity      FLOAT
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

-- ── 5. 운영 편의 뷰 (관리자 점검용) ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_fss_ingest_status AS
SELECT
    fc.category_code,
    COUNT(*)                                          AS total_contents,
    COUNT(*) FILTER (WHERE fc.embedded_at IS NOT NULL) AS embedded_contents,
    COALESCE(SUM(fc.chunk_count), 0)                   AS total_chunks,
    MAX(fc.embedded_at)                                AS last_embedded_at
FROM fss_contents fc
GROUP BY fc.category_code
ORDER BY fc.category_code;
