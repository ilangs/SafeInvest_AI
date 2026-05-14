"""
app/services/rag_chain.py — AI 챗봇의 단일 질의 RAG 체인
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  사용자 질문을 임베딩 → Supabase pgvector에서 유사 문서 검색 → 검색된
  문서를 컨텍스트로 GPT에게 전달 → 안전한 투자 답변 생성.

[처음 보는 분께 RAG란]
  RAG = Retrieval-Augmented Generation (검색 증강 생성)
  - 순수 LLM은 환각(거짓 답변) 위험 + 최신 정보 부재
  - RAG는 신뢰할 수 있는 외부 문서를 먼저 찾아오고, 그 문서를 근거로
    답변 생성 → 환각 ↓ + 출처 추적 가능

[처리 흐름]
  질문 → text-embedding-3-small (1536-dim 벡터)
       → supabase_admin.rpc('match_knowledge', query_embedding, threshold)
       → 유사도 상위 K개 청크 회수
       → LCEL 파이프: { context, question } | prompt | gpt-4o-mini | parser
       → 답변 (출처 URL 포함)

[안전 튜터 페르소나]
  프롬프트에 "특정 종목 매수/매도 추천 금지, 위험 고지 포함" 명시
  → 금융 사기·과도 매수 조장 방지

[LangChain 버전 원칙 (반드시 준수)]
  - 사용 금지 : from langchain.chains import RetrievalQA   (구버전)
  - 사용 필수 : LCEL (RunnablePassthrough, | 파이프 연산자)

[SupabaseVectorStore 비호환 주의]
  langchain_community.vectorstores.SupabaseVectorStore 는
  supabase-py 2.x 와 호환되지 않습니다 (params 속성 오류).
  → supabase_admin.rpc('match_knowledge') 직접 호출로 우회.

[멀티스텝 챗봇과의 차이]
  - rag_chain.py    : 단일 질의 → 단일 답변 (이 파일)
  - chatbot_graph.py: LangGraph 멀티 노드 (retrieve → route → generate → save)

흐름:
  질문 → OpenAI 임베딩 → Supabase RPC 검색 → GPT-4o 답변 → chat_history 저장
"""

import uuid
from datetime import datetime, timezone

from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda, RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.core.config import settings
from app.core.supabase import supabase_admin

_SYSTEM_PROMPT = """당신은 건전한 주식 투자를 안내하는 AI 선생님 '세이프'입니다.

반드시 지켜야 할 원칙:
1. 항상 건전 투자 관점에서 답변합니다.
2. "대박", "무조건 오른다", "지금 사야 한다" 같은 표현은 절대 사용하지 않습니다.
3. 분산투자와 장기투자 관점을 항상 강조합니다.
4. 모르는 내용은 솔직히 모른다고 말하고 외부 링크를 안내합니다.
5. 답변 마지막에 참조 자료가 있으면 출처를 안내합니다.

[참조 자료]
{context}"""


# ── 싱글턴 (첫 호출 시 초기화) ───────────────────────────────────────────────

_embeddings: OpenAIEmbeddings | None = None
_llm: ChatOpenAI | None = None


def _get_embeddings() -> OpenAIEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=settings.openai_api_key,
        )
    return _embeddings


def _get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            api_key=settings.openai_api_key,
        )
    return _llm


# ── Supabase RPC 직접 검색 ────────────────────────────────────────────────────

async def _search_knowledge(question: str, k: int = 5, threshold: float = 0.3) -> list[Document]:
    """
    Supabase RPC match_knowledge 를 직접 호출하여 유사 문서를 반환합니다.
    supabase-py 2.x 와 호환되는 방식입니다.
    threshold를 낮게 설정(0.3)하여 초기 데이터에서도 검색이 가능하게 합니다.
    """
    try:
        vector = await _get_embeddings().aembed_query(question)

        resp = supabase_admin.rpc(
            "match_knowledge",
            {
                "query_embedding": vector,
                "match_count":     k,
                "threshold":       threshold,
                "filter":          {},
            },
        ).execute()

        docs = []
        for row in (resp.data or []):
            docs.append(Document(
                page_content=row.get("content", ""),
                metadata={
                    "source":     row.get("source", ""),
                    "source_url": row.get("source_url", ""),
                    "chunk_id":   str(row.get("chunk_id", "")),
                    "similarity": row.get("similarity", 0.0),
                },
            ))
        return docs

    except Exception as e:
        print(f"[rag_chain] 검색 오류: {e}")
        return []


def _format_docs(docs: list[Document]) -> str:
    if not docs:
        return "참조 자료 없음"
    parts = []
    for doc in docs:
        src = doc.metadata.get("source", "")
        parts.append(f"{doc.page_content}\n(출처: {src})" if src else doc.page_content)
    return "\n\n---\n\n".join(parts)


# ── 공개 인터페이스 ───────────────────────────────────────────────────────────

async def ask(question: str, user_id: str, session_id: str | None = None) -> dict:
    """
    RAG 체인을 실행하고 결과를 chat_history 에 저장합니다.

    Returns
    -------
    {
        "answer":      str,
        "session_id":  str,
        "sources":     list[str],
        "source_url":  str | None,
        "answered_at": datetime,
    }
    """
    if session_id is None:
        session_id = str(uuid.uuid4())

    try:
        # 1. 유사 문서 검색
        source_docs = await _search_knowledge(question)

        # 2. LLM 답변 생성 (LCEL)
        prompt = ChatPromptTemplate.from_messages([
            ("system", _SYSTEM_PROMPT),
            ("human", "{question}"),
        ])
        chain = prompt | _get_llm() | StrOutputParser()

        context = _format_docs(source_docs)
        answer: str = await chain.ainvoke({"context": context, "question": question})

    except Exception as e:
        print(f"[rag_chain] 체인 오류: {e}")
        answer = _fallback_answer(question)
        source_docs = []

    # 3. 출처 수집
    sources: list[str] = list({
        doc.metadata["source"]
        for doc in source_docs
        if doc.metadata.get("source")
    })

    source_url: str | None = next(
        (doc.metadata["source_url"] for doc in source_docs if doc.metadata.get("source_url")),
        None,
    )

    # 4. 상담 이력 저장
    try:
        supabase_admin.table("chat_history").insert({
            "user_id":    user_id,
            "question":   question,
            "answer":     answer,
            "session_id": session_id,
        }).execute()
    except Exception as e:
        print(f"[rag_chain] chat_history 저장 오류: {e}")

    return {
        "answer":      answer,
        "session_id":  session_id,
        "sources":     sources,
        "source_url":  source_url,
        "answered_at": datetime.now(tz=timezone.utc),
    }


def _fallback_answer(question: str) -> str:
    return (
        "안녕하세요, AI 선생님 '세이프'입니다. "
        "현재 학습 자료를 불러오는 중이거나 연결에 문제가 있어 답변을 드리기 어렵습니다. "
        "잠시 후 다시 질문해 주시거나, "
        "[금융감독원 금융교육포털](https://www.fss.or.kr/edu) 에서 도움을 받아 보세요."
    )
