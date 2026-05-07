"""
app/routers/study_logs.py
──────────────────────────
학습 일기 CRUD 엔드포인트.

GET    /api/v1/study-logs           목록 조회 (페이지네이션)
POST   /api/v1/study-logs           신규 작성 (AI 코멘트 자동 생성)
PUT    /api/v1/study-logs/{log_id}  수정
DELETE /api/v1/study-logs/{log_id}  삭제
"""

import math
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.core.supabase import supabase_admin
from app.core.security import TokenData
from app.dependencies import get_current_user
from app.models.schemas import (
    StudyLogCreate,
    StudyLogUpdate,
    StudyLogItem,
    StudyLogListResponse,
)

router = APIRouter(prefix="/api/v1/study-logs", tags=["study-logs"])

_AI_COMMENT_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "당신은 건전한 주식 투자를 안내하는 AI 선생님 '세이프'입니다. "
        "사용자의 학습 일기를 읽고, 격려와 투자 관점의 조언을 담은 "
        "한 문장(30자 이내)으로만 응답하세요. 다른 말은 절대 쓰지 마세요.",
    ),
    ("human", "{content}"),
])

_FALLBACK_COMMENT = "오늘도 꾸준히 기록하는 습관이 좋은 투자자를 만듭니다."


async def _generate_ai_comment(content: str) -> str:
    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            openai_api_key=settings.openai_api_key,
        )
        chain = _AI_COMMENT_PROMPT | llm | StrOutputParser()
        return await chain.ainvoke({"content": content[:500]})
    except Exception:
        return _FALLBACK_COMMENT


# ── GET 목록 ──────────────────────────────────────────────────────────────────

@router.get("", response_model=StudyLogListResponse, summary="학습 일기 목록 조회")
async def list_study_logs(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(5, ge=1, le=20, description="페이지 당 항목 수"),
    current_user: TokenData = Depends(get_current_user),
):
    today = date.today().isoformat()
    offset = (page - 1) * size

    count_resp = (
        supabase_admin.table("study_logs")
        .select("id", count="exact")
        .eq("user_id", current_user.user_id)
        .execute()
    )
    total = count_resp.count or 0

    today_resp = (
        supabase_admin.table("study_logs")
        .select("id", count="exact")
        .eq("user_id", current_user.user_id)
        .eq("log_date", today)
        .execute()
    )
    today_count = today_resp.count or 0

    data_resp = (
        supabase_admin.table("study_logs")
        .select("id, title, content, tag, mood, ai_comment, log_date, created_at, updated_at")
        .eq("user_id", current_user.user_id)
        .order("log_date", desc=True)
        .order("created_at", desc=True)
        .range(offset, offset + size - 1)
        .execute()
    )

    return StudyLogListResponse(
        logs=data_resp.data or [],
        total=total,
        page=page,
        total_pages=max(math.ceil(total / size), 1),
        today_count=today_count,
    )


# ── POST 작성 ─────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=StudyLogItem,
    status_code=status.HTTP_201_CREATED,
    summary="학습 일기 작성 (AI 코멘트 자동 생성)",
)
async def create_study_log(
    body: StudyLogCreate,
    current_user: TokenData = Depends(get_current_user),
):
    ai_comment = await _generate_ai_comment(body.content)

    resp = (
        supabase_admin.table("study_logs")
        .insert({
            "user_id":    current_user.user_id,
            "title":      body.title,
            "content":    body.content,
            "tag":        body.tag,
            "mood":       body.mood,
            "ai_comment": ai_comment,
            "log_date":   date.today().isoformat(),
        })
        .execute()
    )
    return resp.data[0]


# ── PUT 수정 ──────────────────────────────────────────────────────────────────

@router.put("/{log_id}", response_model=StudyLogItem, summary="학습 일기 수정")
async def update_study_log(
    log_id: str,
    body: StudyLogUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    check = (
        supabase_admin.table("study_logs")
        .select("id")
        .eq("id", log_id)
        .eq("user_id", current_user.user_id)
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="학습 일기를 찾을 수 없습니다.")

    update_data = body.model_dump(exclude_unset=True, exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="수정할 내용이 없습니다.")

    resp = (
        supabase_admin.table("study_logs")
        .update(update_data)
        .eq("id", log_id)
        .eq("user_id", current_user.user_id)
        .execute()
    )
    return resp.data[0]


# ── DELETE 삭제 ───────────────────────────────────────────────────────────────

@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT, summary="학습 일기 삭제")
async def delete_study_log(
    log_id: str,
    current_user: TokenData = Depends(get_current_user),
):
    resp = (
        supabase_admin.table("study_logs")
        .delete()
        .eq("id", log_id)
        .eq("user_id", current_user.user_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="학습 일기를 찾을 수 없습니다.")
