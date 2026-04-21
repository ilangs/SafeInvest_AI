"""
app/routers/watchlist.py
─────────────────────────
관심종목 CRUD 엔드포인트.

GET    /api/v1/watchlist              본인 관심종목 목록
POST   /api/v1/watchlist              관심종목 추가
DELETE /api/v1/watchlist/{stock_code} 관심종목 삭제
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.core.supabase import supabase_admin
from app.models.schemas import WatchlistItem, WatchlistRequest

router = APIRouter(prefix="/api/v1/watchlist", tags=["watchlist"])


@router.get(
    "",
    response_model=list[WatchlistItem],
    summary="관심종목 목록 조회",
)
async def get_watchlist(current_user: TokenData = Depends(get_current_user)):
    resp = (
        supabase_admin.table("watchlist")
        .select("stock_code, stock_name, created_at")
        .eq("user_id", current_user.user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data


@router.post(
    "",
    response_model=WatchlistItem,
    status_code=status.HTTP_201_CREATED,
    summary="관심종목 추가",
)
async def add_watchlist(
    body: WatchlistRequest,
    current_user: TokenData = Depends(get_current_user),
):
    try:
        resp = (
            supabase_admin.table("watchlist")
            .insert({
                "user_id":    current_user.user_id,
                "stock_code": body.stock_code,
                "stock_name": body.stock_name,
            })
            .execute()
        )
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{body.stock_code} 는 이미 관심종목에 등록되어 있습니다.",
            )
        raise HTTPException(status_code=500, detail=str(e))

    return resp.data[0]


@router.delete(
    "/{stock_code}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="관심종목 삭제",
)
async def remove_watchlist(
    stock_code: str,
    current_user: TokenData = Depends(get_current_user),
):
    resp = (
        supabase_admin.table("watchlist")
        .delete()
        .eq("user_id", current_user.user_id)
        .eq("stock_code", stock_code)
        .execute()
    )
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{stock_code} 를 관심종목에서 찾을 수 없습니다.",
        )
