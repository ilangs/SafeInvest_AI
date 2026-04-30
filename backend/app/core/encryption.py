"""
app/core/encryption.py
───────────────────────
AES-256 (Fernet) 암호화/복호화.
KIS API 키를 DB에 저장할 때 반드시 암호화합니다.

ENCRYPTION_KEY 형식:
  - Fernet 표준: URL-safe base64 인코딩 32바이트 (권장)
  - 16진수 문자열: 64자리 hex → 자동으로 Fernet 키로 변환
"""
import base64
from cryptography.fernet import Fernet
from app.core.config import settings


def _fernet() -> Fernet:
    key = settings.encryption_key
    if not key:
        raise RuntimeError("ENCRYPTION_KEY 가 설정되지 않았습니다.")

    key_str = key.strip()

    # hex 64자리 → 32바이트 → URL-safe base64 변환
    if len(key_str) == 64 and all(c in "0123456789abcdefABCDEF" for c in key_str):
        raw = bytes.fromhex(key_str)
        key_bytes = base64.urlsafe_b64encode(raw)
    else:
        key_bytes = key_str.encode() if isinstance(key_str, str) else key_str

    return Fernet(key_bytes)


def encrypt(plaintext: str) -> str:
    """평문 문자열을 Fernet 암호화하여 반환합니다."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Fernet 암호문을 복호화하여 평문 문자열로 반환합니다."""
    return _fernet().decrypt(ciphertext.encode()).decode()


def mask_account(account_no: str) -> str:
    """
    계좌번호 마스킹.
    '50123456-01' → '5012****-**'
    '5012345601'  → '5012****01'
    """
    clean = account_no.replace("-", "")
    if len(clean) < 4:
        return "****"
    # 앞 4자리 + 중간 마스킹 + 뒤 2자리
    visible_end = clean[-2:] if len(clean) >= 6 else ""
    middle_len  = max(0, len(clean) - 4 - len(visible_end))
    masked_flat = clean[:4] + "*" * middle_len + visible_end

    # 원본에 '-' 있으면 8자리 뒤에 '-' 삽입
    if "-" in account_no and len(masked_flat) > 8:
        return masked_flat[:8] + "-" + masked_flat[8:]
    return masked_flat
