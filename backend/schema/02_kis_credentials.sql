-- ════════════════════════════════════════════════════════════════════════════
-- SafeInvest AI — 배포 모듈 2 : KIS Credentials (🔐 보안 핵심)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 📌 이 모듈이 하는 일
--   사용자가 등록한 한국투자증권(KIS) API 키·시크릿·계좌번호를
--   AES-256 (Fernet) 으로 암호화하여 저장하는 테이블.
--
-- 📌 보안 설계
--   - 모든 enc_* 컬럼은 backend/app/core/encryption.py 의 Fernet 키로 암호화
--   - ENCRYPTION_KEY 환경변수가 없으면 복호화 불가 → DB만 유출되어도 안전
--   - account_no_masked : UI 표시용 마스킹된 계좌번호 (예: "5012****")
--   - RLS : 사용자는 자기 자격증명만 SELECT/INSERT/UPDATE/DELETE 가능
--   - UNIQUE (user_id, is_mock) : 한 사용자가 모의 1개 + 실거래 1개씩만 보유
--
-- 📌 선행 조건
--   01_foundation.sql 실행 완료 (uuid-ossp 확장 필요)
--
-- 📌 정상 실행 확인
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'user_kis_credentials' ORDER BY ordinal_position;
--   → enc_app_key, enc_app_secret, enc_account_no 등이 있어야 함
-- ════════════════════════════════════════════════════════════════════════════

-- ── user_kis_credentials : KIS 계좌 자격증명 (암호화 저장) ──────────────────
CREATE TABLE IF NOT EXISTS user_kis_credentials (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 암호화된 KIS API 자격증명 (모두 AES-256 Fernet)
    enc_app_key       TEXT        NOT NULL,    -- KIS APP_KEY 암호문
    enc_app_secret    TEXT        NOT NULL,    -- KIS APP_SECRET 암호문
    enc_account_no    TEXT        NOT NULL,    -- 계좌번호 암호문

    -- UI 표시용 (민감하지 않음)
    account_no_masked TEXT        NOT NULL,    -- 예: "5012****"

    -- 환경 구분: 모의투자(true) / 실거래(false)
    is_mock           BOOLEAN     NOT NULL DEFAULT TRUE,

    -- KIS access_token 캐시 (24시간 유효)
    access_token      TEXT,
    token_expires_at  TIMESTAMPTZ,

    is_active         BOOLEAN     DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),

    -- 한 사용자가 모의/실거래 각 1개씩만 보유 가능
    UNIQUE (user_id, is_mock)
);


-- ── RLS : 자기 자격증명만 접근 ───────────────────────────────────────────────
ALTER TABLE user_kis_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kis_cred_self" ON user_kis_credentials;
CREATE POLICY "kis_cred_self"
    ON user_kis_credentials
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ── updated_at 자동 갱신 트리거 ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_kis_cred_updated ON user_kis_credentials;
CREATE TRIGGER trg_kis_cred_updated
    BEFORE UPDATE ON user_kis_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── ✅ 완료 메시지 ───────────────────────────────────────────────────────────
SELECT 'KIS credentials module installed: user_kis_credentials (AES-256 encrypted)' AS result;
