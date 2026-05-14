"""
app/core/encryption.py — 🔐 KIS 자격증명 암호화 (AES-256 / Fernet)
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  사용자가 등록한 KIS(한국투자증권) API 키·시크릿·계좌번호를
  Supabase user_kis_credentials 테이블에 저장하기 전에 AES-256으로 암호화.

[왜 필요한가]
  KIS API 키가 유출되면 = 사용자 실계좌에서 매매 가능. 절대 평문 저장 X.
  DB가 유출되어도 ENCRYPTION_KEY 없이는 키 복원 불가하도록 설계.

[Fernet 이란]
  Python cryptography 라이브러리의 AES-256 CBC + HMAC-SHA256 표준 구현.
  - 인증된 암호화 (변조 감지 가능)
  - URL-safe base64 출력

[ENCRYPTION_KEY 보관]
  - .env 파일의 ENCRYPTION_KEY 환경변수
  - 절대 git에 커밋 금지 (.gitignore 확인)
  - 생성: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
  - 형식 자동 인식: Fernet 표준 base64 또는 hex 64자

[사용 예시]
  enc = encrypt("PSxxxxxxxxxxxxxx")     # 평문 → 암호문 (DB 저장용)
  dec = decrypt(enc)                    # 암호문 → 평문 (KIS API 호출 직전)
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
