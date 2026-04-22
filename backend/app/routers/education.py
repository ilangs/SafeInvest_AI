"""
app/routers/education.py
─────────────────────────
교육 튜터 시스템 엔드포인트.

GET  /api/v1/education/units              전체 단원 목록 (stage별)
GET  /api/v1/education/units/{unit_id}   단원 상세 (본문+퀴즈, quiz_answer 제외)
GET  /api/v1/education/progress          내 학습 진도
POST /api/v1/education/progress          단원 완료 저장
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.core.security import TokenData
from app.core.supabase import supabase_admin
from app.models.schemas import (
    UnitSummary,
    UnitDetail,
    ProgressRequest,
    ProgressResponse,
    QuizSubmitRequest,
    QuizSubmitResponse,
)

router = APIRouter(prefix="/api/v1/education", tags=["education"])


@router.get("/units", response_model=list[UnitSummary], summary="전체 단원 목록")
async def list_units(_: TokenData = Depends(get_current_user)):
    res = (
        supabase_admin.table("education_units")
        .select("id, stage, unit_number, title, description")
        .order("stage")
        .order("unit_number")
        .execute()
    )
    return res.data


@router.get("/units/{unit_id}", response_model=UnitDetail, summary="단원 상세")
async def get_unit(unit_id: str, _: TokenData = Depends(get_current_user)):
    res = (
        supabase_admin.table("education_units")
        .select(
            "id, stage, unit_number, title, description, content, "
            "quiz_question, quiz_options, source_url, source_label"
        )
        .eq("id", unit_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="단원을 찾을 수 없습니다.")
    return res.data


@router.post("/units/{unit_id}/quiz", response_model=QuizSubmitResponse, summary="퀴즈 정답 채점 및 진도 저장")
async def submit_quiz(
    unit_id: str,
    body: QuizSubmitRequest,
    current_user: TokenData = Depends(get_current_user),
):
    res = (
        supabase_admin.table("education_units")
        .select("quiz_answer, quiz_explain")
        .eq("id", unit_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="단원을 찾을 수 없습니다.")

    correct = body.selected_index == res.data["quiz_answer"]
    now = datetime.now(tz=timezone.utc).isoformat()
    record = {
        "user_id": current_user.user_id,
        "unit_id": unit_id,
        "completed": True,
        "quiz_passed": correct,
        "completed_at": now,
    }
    supabase_admin.table("learning_progress").upsert(record, on_conflict="user_id,unit_id").execute()

    return QuizSubmitResponse(correct=correct, explanation=res.data.get("quiz_explain"))


@router.get("/progress", response_model=list[ProgressResponse], summary="내 학습 진도")
async def get_progress(current_user: TokenData = Depends(get_current_user)):
    res = (
        supabase_admin.table("learning_progress")
        .select("unit_id, completed, quiz_passed, completed_at")
        .eq("user_id", current_user.user_id)
        .execute()
    )
    return res.data


@router.post("/progress", response_model=ProgressResponse, summary="단원 완료 저장")
async def save_progress(
    body: ProgressRequest,
    current_user: TokenData = Depends(get_current_user),
):
    now = datetime.now(tz=timezone.utc).isoformat()
    record = {
        "user_id": current_user.user_id,
        "unit_id": body.unit_id,
        "completed": body.completed,
        "quiz_passed": body.quiz_passed,
        "completed_at": now if body.completed else None,
    }
    res = (
        supabase_admin.table("learning_progress")
        .upsert(record, on_conflict="user_id,unit_id")
        .execute()
    )
    data = res.data[0] if res.data else record
    return ProgressResponse(
        unit_id=data["unit_id"],
        completed=data["completed"],
        quiz_passed=data["quiz_passed"],
        completed_at=data.get("completed_at"),
    )
