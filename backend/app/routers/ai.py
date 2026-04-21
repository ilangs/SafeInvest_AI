"""
app/routers/ai.py
──────────────────
AI 상담 엔드포인트.

POST /api/v1/ai/chat   질문 → RAG → 답변 반환
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import ChatRequest, ChatResponse
from app.services import rag_chain

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="AI 투자 상담",
)
async def chat(
    body: ChatRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """
    사용자 질문을 RAG 체인으로 처리하고 건전 투자 가이드를 반환합니다.
    상담 이력은 chat_history 테이블에 자동 저장됩니다.
    """
    result = await rag_chain.ask(
        question=body.question,
        user_id=current_user.user_id,
        session_id=body.session_id,
    )
    return ChatResponse(**result)
