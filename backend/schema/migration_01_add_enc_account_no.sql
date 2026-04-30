-- ============================================================
-- Migration 01: enc_account_no 컬럼 추가
-- 기존 테이블에 enc_account_no 가 없는 경우 실행
-- ============================================================
-- Supabase SQL Editor 에서 실행하세요.

-- 1) 컬럼이 없으면 추가 (nullable – 기존 행 호환)
ALTER TABLE user_kis_credentials
    ADD COLUMN IF NOT EXISTS enc_account_no TEXT;

-- 2) 현재 스키마 확인
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_kis_credentials'
ORDER BY ordinal_position;
