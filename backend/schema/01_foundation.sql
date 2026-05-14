-- ════════════════════════════════════════════════════════════════════════════
-- SafeInvest AI — 배포 모듈 1 : Foundation (기반 시설)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 📌 이 모듈이 하는 일
--   - PostgreSQL 확장 설치 (uuid-ossp, pgvector, moddatetime)
--   - 공통 트리거 함수 (updated_at 자동 갱신)
--   - 사용자 기본 테이블: user_profiles, user_settings, watchlist
--   - 신규 가입 시 user_profiles 자동 생성 트리거
--
-- 📌 실행 순서
--   1️⃣ 이 파일 → 2️⃣ 02_kis_credentials → 3️⃣ 03_trading
--   → 4️⃣ 04_market_analysis → 5️⃣ 05_ai_education
--
-- 📌 실행 방법
--   Supabase Dashboard → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run
--
-- 📌 정상 실행 확인
--   다음 쿼리가 3을 반환해야 함:
--     SELECT COUNT(*) FROM information_schema.tables
--      WHERE table_name IN ('user_profiles','user_settings','watchlist');
-- ════════════════════════════════════════════════════════════════════════════

-- ── [1] PostgreSQL 확장 ─────────────────────────────────────────────────────
-- uuid-ossp   : UUID 생성 함수 (gen_random_uuid 대신 uuid_generate_v4 사용 가능)
-- vector      : pgvector — 임베딩 검색 (5번 모듈에서 사용)
-- moddatetime : updated_at 자동 갱신 트리거 함수 제공
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS moddatetime;


-- ── [2] 공통 트리거 함수 ────────────────────────────────────────────────────
-- 여러 테이블의 BEFORE UPDATE 트리거에서 재사용
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── [3] user_profiles : 사용자 프로필 ───────────────────────────────────────
-- auth.users (Supabase Auth) 와 1:1 매핑. 신규 가입 시 자동 생성됨.
CREATE TABLE IF NOT EXISTS user_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname    TEXT,
    risk_level  TEXT DEFAULT 'moderate'
                     CHECK (risk_level IN ('conservative','moderate','aggressive')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ── [4] user_settings : 대시보드 위젯 설정 ──────────────────────────────────
-- layout_json 에 사용자별 위젯 배치 정보를 JSONB 로 저장
CREATE TABLE IF NOT EXISTS user_settings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    layout_json JSONB DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ── [5] watchlist : 관심종목 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stock_code  TEXT NOT NULL,
    stock_name  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, stock_code)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);


-- ── [6] Row Level Security (자기 데이터만 접근) ─────────────────────────────
ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self" ON user_profiles;
CREATE POLICY "profiles_self" ON user_profiles USING (auth.uid() = id);

DROP POLICY IF EXISTS "settings_self" ON user_settings;
CREATE POLICY "settings_self" ON user_settings USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "watchlist_self" ON watchlist;
CREATE POLICY "watchlist_self" ON watchlist  USING (auth.uid() = user_id);


-- ── [7] 신규 가입 시 user_profiles 자동 생성 트리거 ─────────────────────────
-- auth.users 에 INSERT 가 발생하면 동일 ID 로 user_profiles 행을 만든다.
-- SECURITY DEFINER : RLS 우회. 가입 직후엔 auth.uid() 가 비어있을 수 있음.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id)
    VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── [8] updated_at 자동 갱신 트리거 ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── ✅ 완료 메시지 ──────────────────────────────────────────────────────────
SELECT 'Foundation module installed: user_profiles, user_settings, watchlist + extensions' AS result;
