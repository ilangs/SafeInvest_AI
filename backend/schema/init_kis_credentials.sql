-- SafeInvest KIS credentials schema
-- Run this in Supabase SQL editor if the table does not exist yet.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS user_kis_credentials (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enc_app_key      TEXT        NOT NULL,
    enc_app_secret   TEXT        NOT NULL,
    enc_account_no   TEXT        NOT NULL,
    account_no_masked TEXT       NOT NULL,
    is_mock          BOOLEAN     NOT NULL DEFAULT TRUE,
    access_token     TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active        BOOLEAN     DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, is_mock)
);

ALTER TABLE user_kis_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kis_cred_self" ON user_kis_credentials;
CREATE POLICY "kis_cred_self"
    ON user_kis_credentials
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_kis_cred_updated ON user_kis_credentials;
CREATE TRIGGER trg_kis_cred_updated
    BEFORE UPDATE ON user_kis_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'user_kis_credentials table ready' AS result;
