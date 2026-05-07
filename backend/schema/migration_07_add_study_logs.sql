-- migration_07_add_study_logs.sql
-- 사용자별 주식 공부 기록 / 투자 학습 일기 테이블

-- moddatetime 익스텐션 (updated_at 자동 갱신)
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- ── 테이블 생성 ──────────────────────────────────────────────────────────────

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

-- ── 인덱스 ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_study_logs_user_date
    ON study_logs (user_id, log_date DESC, created_at DESC);

-- ── RLS (행 수준 보안) ────────────────────────────────────────────────────────

ALTER TABLE study_logs ENABLE ROW LEVEL SECURITY;

-- 자신의 기록만 SELECT / INSERT / UPDATE / DELETE 가능
CREATE POLICY "Users can manage own study logs"
    ON study_logs
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── updated_at 자동 갱신 트리거 ──────────────────────────────────────────────

CREATE TRIGGER trg_study_logs_updated_at
    BEFORE UPDATE ON study_logs
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime(updated_at);
