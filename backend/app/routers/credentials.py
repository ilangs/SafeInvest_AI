"""
app/routers/credentials.py — 🔐 KIS 계좌 자격증명 관리 API
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  사용자가 MyPage에서 KIS API 키·시크릿·계좌번호를 입력 → 이 API가
  ① AES-256 암호화 후 user_kis_credentials 테이블에 저장
  ② KIS API에 토큰 발급 요청 → 키 유효성 즉시 검증
  ③ 모의(Mock) / 실거래(Real) 환경을 분리 관리 (is_mock 컬럼)

[보안 흐름]
  사용자 입력 → POST /connect
    ├─ encryption.encrypt() 로 즉시 암호화
    ├─ Supabase admin 클라이언트로 INSERT/UPDATE
    └─ 응답에는 마스킹된 일부 정보만 (예: "PS****1234")

[엔드포인트]
  GET    /api/v1/credentials/status      모의/실거래 연결 상태
  GET    /api/v1/credentials/profile     폼 자동완성용 마스킹된 정보
  POST   /api/v1/credentials/connect     키 등록 + 즉시 검증
  DELETE /api/v1/credentials/{is_mock}   연결 해제 (DB row 삭제)

[프론트 사용처]
  - MyPage: 계좌 연결 폼
  - TradePage: 초기 진입 시 connected 상태 + is_mock 결정에 사용
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.core.security import TokenData
from app.core.supabase import supabase_admin
from app.core.encryption import decrypt, encrypt, mask_account
from app.services.kis_client import get_access_token_with_key, REAL_TRADING_ENABLED

router = APIRouter(prefix="/api/v1/credentials", tags=["credentials"])


# ── 스키마 ─────────────────────────────────────────────────────────────────────

class KISConnectRequest(BaseModel):
    app_key:    str  = Field(..., min_length=10, description="KIS APP KEY")
    app_secret: str  = Field(..., min_length=10, description="KIS APP SECRET")
    account_no: str  = Field(..., description="계좌번호 (예: 50123456-01 또는 5012345601)")
    is_mock:    bool = Field(True, description="True=모의투자, False=실거래")


class KISStatusResponse(BaseModel):
    is_connected:      bool
    is_mock:           bool
    account_no_masked: str | None
    token_valid:       bool


class KISProfileResponse(BaseModel):
    is_mock:           bool
    app_key:           str | None = None
    app_secret:        str | None = None
    account_no:        str | None = None
    account_no_masked: str | None = None


# ── 연결 상태 조회 ─────────────────────────────────────────────────────────────

@router.get("/status", response_model=list[KISStatusResponse])
async def get_status(current_user: TokenData = Depends(get_current_user)):
    """모의투자 / 실거래 계좌 연결 상태를 각각 반환합니다."""

    # 기본값: 두 모드 모두 미연결
    result: list[KISStatusResponse] = [
        KISStatusResponse(is_connected=False, is_mock=True,  account_no_masked=None, token_valid=False),
        KISStatusResponse(is_connected=False, is_mock=False, account_no_masked=None, token_valid=False),
    ]

    try:
        rows = (
            supabase_admin.table("user_kis_credentials")
            .select("is_mock,account_no_masked,token_expires_at,is_active")
            .eq("user_id", current_user.user_id)
            .eq("is_active", True)
            .execute()
            .data
        ) or []
    except Exception as e:
        # DB 오류 시 기본값(미연결) 반환 – 500 방지
        print(f"[credentials/status] Supabase 조회 오류: {e}")
        return result

    connected: dict[bool, KISStatusResponse] = {}
    for row in rows:
        exp   = row.get("token_expires_at")
        valid = False
        if exp:
            try:
                dt = datetime.fromisoformat(exp)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                valid = dt > datetime.now(tz=timezone.utc)
            except (ValueError, TypeError):
                pass

        connected[row["is_mock"]] = KISStatusResponse(
            is_connected=True,
            is_mock=row["is_mock"],
            account_no_masked=row.get("account_no_masked"),
            token_valid=valid,
        )

    # 연결된 모드는 실제 결과로 교체
    return [
        connected.get(True,  result[0]),
        connected.get(False, result[1]),
    ]


# ── 프로필 조회 (폼 자동완성) ──────────────────────────────────────────────────

@router.get("/profile", response_model=list[KISProfileResponse])
async def get_profile(current_user: TokenData = Depends(get_current_user)):
    """저장된 KIS 키를 복호화해서 반환 (폼 자동완성용)."""
    try:
        rows = (
            supabase_admin.table("user_kis_credentials")
            .select("is_mock,enc_app_key,enc_app_secret,enc_account_no,account_no_masked")
            .eq("user_id", current_user.user_id)
            .execute()
            .data
        ) or []
    except Exception:
        try:
            rows = (
                supabase_admin.table("user_kis_credentials")
                .select("is_mock,enc_app_key,enc_app_secret,account_no_masked")
                .eq("user_id", current_user.user_id)
                .execute()
                .data
            ) or []
        except Exception:
            return []

    result: list[KISProfileResponse] = []
    for row in rows:
        app_key    = None
        app_secret = None
        account_no = None

        try:
            if row.get("enc_app_key"):
                app_key = decrypt(row["enc_app_key"])
        except Exception:
            pass
        try:
            if row.get("enc_app_secret"):
                app_secret = decrypt(row["enc_app_secret"])
        except Exception:
            pass
        try:
            if row.get("enc_account_no"):
                account_no = decrypt(row["enc_account_no"])
        except Exception:
            pass

        result.append(KISProfileResponse(
            is_mock=row["is_mock"],
            app_key=app_key,
            app_secret=app_secret,
            account_no=account_no,
            account_no_masked=row.get("account_no_masked"),
        ))

    return result


# ── 계좌 연결 ──────────────────────────────────────────────────────────────────

@router.post("/connect")
async def connect(
    body: KISConnectRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """KIS 키 등록 및 연결 테스트.

    ★ 현재 모의투자 계좌만 등록 가능 (실거래는 차후 서비스 예정).
    ★ 저장 전 KIS 모의 도메인으로 토큰 발급을 선검증 —
      실거래 APP_KEY 는 모의 도메인에서 토큰이 발급되지 않으므로,
      검증 실패 시 저장 자체를 차단해 실거래 키가 모의 슬롯에 들어오는 것을 막는다.
    """
    masked = mask_account(body.account_no)

    # ── 0) 실거래 계좌 등록 차단 ──────────────────────────────────────────────
    if not body.is_mock and not REAL_TRADING_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="실거래 계좌 등록은 차후 서비스 예정입니다. 현재는 모의투자 계좌만 등록할 수 있습니다.",
        )

    # ── 1) KIS 토큰 발급 선검증 (저장 전) ─────────────────────────────────────
    #   모의투자 APP_KEY 는 모의 도메인(openapivts)에서만 토큰이 발급됨.
    #   실거래 키를 입력하면 여기서 실패 → 저장하지 않고 즉시 거부.
    try:
        token = await get_access_token_with_key(body.app_key, body.app_secret, body.is_mock)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "모의투자 계좌 검증에 실패했습니다. 모의투자 전용 APP KEY·SECRET 인지 "
                "확인해 주세요. (실거래 키는 등록할 수 없습니다.) "
                f"[{str(e)[:80]}]"
            ),
        )

    # ── 2) 검증 성공 → 암호화 저장 (upsert) ──────────────────────────────────
    expires_at = (datetime.now(tz=timezone.utc) + timedelta(hours=23)).isoformat()
    upsert_data: dict = {
        "user_id":           current_user.user_id,
        "enc_app_key":       encrypt(body.app_key),
        "enc_app_secret":    encrypt(body.app_secret),
        "account_no_masked": masked,
        "is_mock":           body.is_mock,
        "is_active":         True,
        "access_token":      token,
        "token_expires_at":  expires_at,
    }
    # enc_account_no 컬럼이 있을 때만 포함 (없으면 DB 에러 방지)
    try:
        upsert_data["enc_account_no"] = encrypt(body.account_no)
    except Exception:
        pass

    try:
        supabase_admin.table("user_kis_credentials").upsert(
            upsert_data,
            on_conflict="user_id,is_mock",
        ).execute()
    except Exception as e:
        err_msg = str(e)
        # enc_account_no 컬럼 없음 → 해당 필드 제외 후 재시도
        if "enc_account_no" in err_msg:
            upsert_data.pop("enc_account_no", None)
            try:
                supabase_admin.table("user_kis_credentials").upsert(
                    upsert_data,
                    on_conflict="user_id,is_mock",
                ).execute()
            except Exception as e2:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"계좌 정보 저장 실패: {str(e2)[:120]}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"계좌 정보 저장 실패: {err_msg[:120]}",
            )

    return {
        "success":          True,
        "message":          f"모의투자 계좌 연결 완료 ({masked})",
        "token_valid":      True,
        "account_no_masked": masked,
    }


# ── 연결 해제 ──────────────────────────────────────────────────────────────────

@router.delete("/{is_mock}")
async def disconnect(
    is_mock: bool,
    current_user: TokenData = Depends(get_current_user),
):
    """모의투자(True) 또는 실거래(False) 계좌 연결을 해제합니다."""
    try:
        supabase_admin.table("user_kis_credentials").delete().eq(
            "user_id", current_user.user_id
        ).eq("is_mock", is_mock).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"연결 해제 실패: {str(e)[:80]}",
        )

    return {
        "success": True,
        "message": f"{'모의투자' if is_mock else '실거래'} 계좌 연결이 해제됐습니다.",
    }
