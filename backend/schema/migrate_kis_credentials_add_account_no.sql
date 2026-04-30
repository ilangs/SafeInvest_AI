-- Add encrypted account number storage for KIS credentials

ALTER TABLE user_kis_credentials
ADD COLUMN IF NOT EXISTS enc_account_no TEXT;

UPDATE user_kis_credentials
SET enc_account_no = enc_account_no
WHERE enc_account_no IS NOT NULL;
