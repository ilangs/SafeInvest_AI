-- ============================================================
-- safeInvest 주식용어 백과사전 — Supabase 스키마
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS stock_terms (
  id           TEXT PRIMARY KEY,               -- T001 ~ T095
  term         TEXT NOT NULL,                  -- 표시 용어명 (PER, 코스피...)
  term_ko      TEXT,                           -- 한국어 정식명 (영문 약어일 때)
  category     TEXT NOT NULL,                  -- 카테고리
  importance   SMALLINT DEFAULT 3
               CHECK (importance BETWEEN 1 AND 5),
  initial_ko   TEXT,                           -- ㄱ ㄴ ... ㅎ # (한글 시작 용어)
  initial_en   TEXT,                           -- A B ... Z    (영문 시작 용어)
  tags         TEXT[]  DEFAULT '{}',           -- 태그 배열
  related_ids  TEXT[]  DEFAULT '{}',           -- 연관 용어 ID 배열
  description  TEXT    NOT NULL,               -- 정식 정의
  easy_desc    TEXT,                           -- 쉬운 설명 (초보자용)
  formula      TEXT,                           -- 계산식
  caution      TEXT,                           -- 주의사항
  view_count   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 검색 인덱스
-- 한글 초성 탭 필터용
CREATE INDEX IF NOT EXISTS idx_terms_initial_ko
  ON stock_terms(initial_ko)
  WHERE initial_ko IS NOT NULL;

-- 영문 알파벳 탭 필터용
CREATE INDEX IF NOT EXISTS idx_terms_initial_en
  ON stock_terms(initial_en)
  WHERE initial_en IS NOT NULL;

-- 카테고리 필터용
CREATE INDEX IF NOT EXISTS idx_terms_category
  ON stock_terms(category);

-- 중요도 정렬용
CREATE INDEX IF NOT EXISTS idx_terms_importance
  ON stock_terms(importance DESC);

-- 전문 검색 (term + term_ko + description 통합)
CREATE INDEX IF NOT EXISTS idx_terms_fts
  ON stock_terms
  USING GIN (
    to_tsvector(
      'simple',
      term || ' ' ||
      COALESCE(term_ko, '') || ' ' ||
      description
    )
  );

-- 3. 조회수 자동 업데이트 함수
CREATE OR REPLACE FUNCTION increment_view_count(term_id TEXT)
RETURNS VOID AS $$
  UPDATE stock_terms
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE id = term_id;
$$ LANGUAGE SQL;

-- 4. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON stock_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- 5. Row Level Security (읽기 공개, 쓰기 인증 필요)
ALTER TABLE stock_terms ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "public_read"
  ON stock_terms FOR SELECT
  USING (true);

-- 인증된 사용자만 INSERT/UPDATE/DELETE
CREATE POLICY "auth_write"
  ON stock_terms FOR ALL
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 6. JSON 시드 데이터 업로드 방법 (3가지 중 택1)
-- ============================================================
--
-- [방법 A] Supabase 대시보드 → Table Editor
--   → stock_terms 테이블 선택
--   → "Insert" 버튼 → "Import data from CSV/JSON"
--   → stock_terms.json 파일 업로드
--
-- [방법 B] supabase CLI 사용
--   $ supabase db reset          # 테이블 초기화 후
--   $ psql $DB_URL -c "\copy stock_terms FROM 'stock_terms.json'"
--
-- [방법 C] 앱 코드에서 최초 1회 시드 (개발 환경 권장)
--   import terms from './stock_terms.json'
--   const { error } = await supabase.from('stock_terms').upsert(terms)
--
-- ============================================================
-- 7. 자주 쓰는 쿼리 예시
-- ============================================================

-- 전체 목록 (중요도 순)
-- SELECT id, term, term_ko, category, importance, initial_ko, initial_en, tags
-- FROM stock_terms
-- ORDER BY importance DESC, term ASC;

-- 초성 탭 필터 (ㅅ)
-- SELECT * FROM stock_terms
-- WHERE initial_ko = 'ㅅ'
-- ORDER BY term ASC;

-- 영문 탭 필터 (E)
-- SELECT * FROM stock_terms
-- WHERE initial_en = 'E'
-- ORDER BY term ASC;

-- 카테고리 필터
-- SELECT * FROM stock_terms
-- WHERE category = '가치평가'
-- ORDER BY importance DESC;

-- 검색 (ilike: 대소문자 무시)
-- SELECT * FROM stock_terms
-- WHERE term ILIKE '%per%'
--    OR term_ko ILIKE '%주가%'
--    OR description ILIKE '%주가%'
-- ORDER BY importance DESC;

-- 연관 용어 JOIN (related_ids 배열 기준)
-- SELECT t2.*
-- FROM stock_terms t1
-- JOIN stock_terms t2 ON t2.id = ANY(t1.related_ids)
-- WHERE t1.id = 'T001';
