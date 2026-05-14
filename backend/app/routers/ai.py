"""
app/routers/ai.py
──────────────────
AI 상담 엔드포인트.

POST /api/v1/ai/chat   질문 → RAG → 답변 반환
"""

import gc

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.core.security import TokenData
from app.models.schemas import ChatRequest, ChatResponse
# from app.services import rag_chain
from app.services import chatbot_graph

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
    try:
        result = await chatbot_graph.ask_graph(
            question=body.question,
            user_id=current_user.user_id,
            session_id=body.session_id,
        )
        return ChatResponse(**result)
    finally:
        # LangGraph 상태 객체(GraphState, Document 리스트 등)는 ainvoke 종료 후에도
        # 일시적으로 참조가 남아 있어 Render Free 512MB 환경에서 누적되면 OOM 위험.
        # 응답 직후 명시적 GC 로 즉시 회수한다.
        gc.collect()
