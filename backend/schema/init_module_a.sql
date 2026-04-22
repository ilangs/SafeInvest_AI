-- SafeInvest AI Module A — 교육 진도 테이블
-- Supabase SQL Editor에서 실행

-- 학습 단원 정의 테이블 (시스템 데이터)
CREATE TABLE IF NOT EXISTS education_units (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage        INT  NOT NULL,          -- 1=시장기초 2=재무지표 3=건전투자
    unit_number  INT  NOT NULL,          -- 단원 번호
    title        TEXT NOT NULL,          -- 단원 제목
    description  TEXT,                  -- 단원 설명
    content      TEXT NOT NULL,          -- 학습 본문 (마크다운)
    quiz_question TEXT,                  -- 단원 퀴즈 질문
    quiz_options  JSONB,                 -- ["보기1","보기2","보기3","보기4"]
    quiz_answer   INT,                   -- 정답 인덱스 (0부터)
    quiz_explain  TEXT,                  -- 퀴즈 해설
    source_url    TEXT,                  -- 참고 링크
    source_label  TEXT,                  -- 링크 버튼 텍스트
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (stage, unit_number)
);

-- 사용자 학습 진도 테이블
CREATE TABLE IF NOT EXISTS learning_progress (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unit_id       UUID NOT NULL REFERENCES education_units(id),
    completed     BOOLEAN DEFAULT FALSE,
    quiz_passed   BOOLEAN DEFAULT FALSE,
    completed_at  TIMESTAMPTZ,
    UNIQUE (user_id, unit_id)
);

-- RLS
ALTER TABLE education_units    ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_progress  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_read" ON education_units
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "progress_self" ON learning_progress
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_progress_user
    ON learning_progress(user_id, unit_id);
