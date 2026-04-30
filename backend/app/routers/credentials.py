"""
app/routers/credentials.py
───────────────────────────
KIS 계좌 연결 관리 엔드포인트.

GET    /api/v1/credentials/status         연결 상태 조회 (모의/실거래 각각)
GET    /api/v1/credentials/profile        저장된 키 복원 (폼 자동완성용)
POST   /api/v1/credentials/connect        키 등록 + KIS 연결 테스트
DELETE /api/v1/credentials/{is_mock}      연결 해제
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.core.security import TokenData
from app.core.supabase import supabase_admin
from app.core.encryption import decrypt, encrypt, mask_account
from app.services.kis_client import get_access_token_with_key

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
    """KIS 키 등록 및 연결 테스트."""
    masked = mask_account(body.account_no)

    # ── 1) 암호화 키 저장 (upsert) ────────────────────────────────────────────
    upsert_data: dict = {
        "user_id":           current_user.user_id,
        "enc_app_key":       encrypt(body.app_key),
        "enc_app_secret":    encrypt(body.app_secret),
        "account_no_masked": masked,
        "is_mock":           body.is_mock,
        "is_active":         True,
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

    # ── 2) KIS 토큰 발급 테스트 ───────────────────────────────────────────────
    message    = f"{'모의투자' if body.is_mock else '실거래'} 계좌 저장 완료 ({masked})"
    token_valid = False

    try:
        token      = await get_access_token_with_key(body.app_key, body.app_secret, body.is_mock)
        expires_at = (datetime.now(tz=timezone.utc) + timedelta(hours=23)).isoformat()
        # update 사용 – 불완전 INSERT 로 인한 NOT NULL 위반 방지
        supabase_admin.table("user_kis_credentials").update(
            {"access_token": token, "token_expires_at": expires_at}
        ).eq("user_id", current_user.user_id).eq("is_mock", body.is_mock).execute()

        message     = f"{'모의투자' if body.is_mock else '실거래'} 계좌 연결 완료 ({masked})"
        token_valid = True
    except Exception as e:
        message = (
            f"{'모의투자' if body.is_mock else '실거래'} 계좌는 저장됐지만 "
            f"KIS 토큰 확인에 실패했습니다. APP KEY·SECRET을 확인해 주세요. "
            f"({str(e)[:100]})"
        )

    return {
        "success":          True,
        "message":          message,
        "token_valid":      token_valid,
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
