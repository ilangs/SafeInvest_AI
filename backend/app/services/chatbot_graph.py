"""
app/services/chatbot_graph.py — LangGraph 기반 멀티스텝 AI 챗봇
═══════════════════════════════════════════════════════════════════════
[이 파일이 하는 일]
  사용자 질문 한 건을 받아 여러 단계의 노드를 거쳐 답변을 생성하는
  "상태 기반(stateful) 워크플로우". 단일 LCEL 체인보다 분기·조건부 처리에 강함.

[처음 보는 분께 LangGraph란]
  LangChain의 상위 라이브러리. 노드(node)와 엣지(edge)로 그래프를 그리고
  각 노드가 상태(state)를 읽고 갱신하며 다음 노드로 넘어가는 구조.
  - 일반 체인: A→B→C 단방향
  - 그래프 : A→(조건)→B 또는 C→D→END  ← 분기/병합 가능

[이 챗봇의 그래프 흐름]

      [START]
         │
         ▼
   [retrieve]              ── FSS 금융교육 문서 RPC 검색
   ① match_knowledge_fss
         │
         ▼
   [route_decision]        ── 검색 결과 유무로 라우팅 결정
   ② source_docs 검사
         │
    조건부 엣지(should_fallback)
         ├──"rag"──────────► [generate_rag]      참조 자료 인용 답변
         │                       │
         └──"fallback"────► [generate_fallback]  일반 금융 상식 기반
                                 │
                                 ▼
                          [save_history]         chat_history DB 저장
                                 │
                                 ▼
                               [END]

[왜 이렇게 설계했나]
  - FSS 데이터에 없는 질문에도 답변 필요 → fallback 노드
  - 답변은 출처 명시 가능해야 함 → rag 노드에서 source_url 첨부
  - 대화 히스토리는 분석·개선용으로 저장 → save_history 노드

[rag_chain.py와의 차이]
  - rag_chain.py    : 단일 LCEL 체인 (질문 → 답변)
  - chatbot_graph.py: 멀티 노드 그래프 (이 파일, 더 정교한 분기)
  - 엔드포인트 /api/v1/ai/chat 가 이 그래프를 호출


⚠️  LangChain 버전 원칙:
  - 사용 금지: from langchain.chains import RetrievalQA
  - 사용 필수: LCEL (| 파이프, RunnablePassthrough)

⚠️  Supabase 호환:
  SupabaseVectorStore (supabase-py 2.x 비호환) 대신
  supabase_admin.rpc('match_knowledge_fss') 직접 호출.
"""

import uuid
from datetime import datetime, timezone
from typing import TypedDict, TYPE_CHECKING, Any

from app.core.config import settings
from app.core.supabase import supabase_admin

if TYPE_CHECKING:
    from langchain_core.documents import Document
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings


# ── 시스템 프롬프트 ───────────────────────────────────────────────────────────

# RAG 경로: 참조 자료가 있을 때 사용 (rag_chain._SYSTEM_PROMPT 와 동일)
_SYSTEM_PROMPT = """당신은 건전한 주식 투자를 안내하는 AI 선생님 '세이프'입니다.

반드시 지켜야 할 원칙:
1. 항상 건전 투자 관점에서 답변합니다.
2. "대박", "무조건 오른다", "지금 사야 한다" 같은 표현은 절대 사용하지 않습니다.
3. 분산투자와 장기투자 관점을 항상 강조합니다.
4. 모르는 내용은 솔직히 모른다고 말하고 외부 링크를 안내합니다.
5. 답변 마지막에 참조 자료가 있으면 출처를 안내합니다.

[참조 자료]
{context}"""

# Fallback 경로: 참조 자료가 없을 때 일반지식으로 답변
_FALLBACK_SYSTEM_PROMPT = """당신은 건전한 주식 투자를 안내하는 AI 선생님 '세이프'입니다.

현재 관련 학습 자료를 찾지 못했습니다.
보유한 일반 금융 지식을 바탕으로 아래 원칙을 지켜 답변하세요:
1. 항상 건전 투자 관점에서 답변합니다.
2. "대박", "무조건 오른다", "지금 사야 한다" 같은 표현은 절대 사용하지 않습니다.
3. 분산투자와 장기투자 관점을 항상 강조합니다.
4. 모르는 내용은 솔직히 모른다고 말하고 외부 링크를 안내합니다.
5. 답변 마지막에 "※ 이 답변은 학습 자료 없이 생성된 일반 정보입니다." 문구를 추가합니다."""


# ── 싱글턴 (첫 호출 시 초기화) ───────────────────────────────────────────────

_embeddings: Any = None
_llm: Any = None


def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        from langchain_openai import OpenAIEmbeddings
        _embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=settings.openai_api_key,
        )
    return _embeddings


def _get_llm():
    """
    답변 생성용 LLM (RAG / Fallback 공용).
    RAG 경로가 우선 동작하며 참조 자료가 정확도를 보강하므로
    비용·속도 효율이 좋은 gpt-4o-mini 로 통일.
    정확도 부족 판단 시 'gpt-4o' 로 변경.
    """
    global _llm
    if _llm is None:
        from langchain_openai import ChatOpenAI
        _llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.3,
            api_key=settings.openai_api_key,
        )
    return _llm


# ── 상태 스키마 ───────────────────────────────────────────────────────────────

class GraphState(TypedDict):
    """LangGraph 노드 간에 공유되는 상태 딕셔너리."""
    question:    str
    user_id:     str
    session_id:  str
    source_docs: list    # retrieve 노드가 채움 (각 원소는 langchain_core.documents.Document)
    context:     str               # generate_* 노드가 채움
    answer:      str               # generate_* 노드가 채움
    route:       str               # "rag" | "fallback"
    sources:     list[str]         # 출처 제목 목록
    source_url:  str | None        # 대표 URL
    answered_at: datetime          # save_history 노드가 채움


# ── 보조 함수 ─────────────────────────────────────────────────────────────────

async def _search_fss(
    question:       str,
    k:              int              = 5,
    threshold:      float            = 0.55,
    category_codes: list[str] | None = None,
) -> list:
    """
    match_knowledge_fss RPC 를 직접 호출하여 FSS 유사 문서를 반환합니다.
    supabase-py 2.x 호환 방식 (SupabaseVectorStore 사용 금지).

    RPC 반환 컬럼: chunk_id, content, title, contents_slno,
                   category_code, source_url, similarity
    """
    from langchain_core.documents import Document
    try:
        vector = await _get_embeddings().aembed_query(question)

        resp = supabase_admin.rpc(
            "match_knowledge_fss",
            {
                "query_embedding": vector,
                "match_count":     k,
                "threshold":       threshold,
                "category_codes":  category_codes,   # None 허용 → SQL DEFAULT
            },
        ).execute()

        docs: list = []
        for row in (resp.data or []):
            docs.append(Document(
                page_content=row.get("content", ""),
                metadata={
                    "title":         row.get("title", ""),
                    "contents_slno": row.get("contents_slno", ""),
                    "category_code": row.get("category_code", ""),
                    "source_url":    row.get("source_url", ""),
                    "similarity":    row.get("similarity", 0.0),
                },
            ))
        return docs

    except Exception as exc:
        print(f"[chatbot_graph] FSS 검색 오류: {exc}")
        return []


def _format_docs(docs: list) -> str:
    """Document 리스트를 LLM 컨텍스트 문자열로 변환합니다."""
    if not docs:
        return "참조 자료 없음"
    parts: list[str] = []
    for doc in docs:
        title = doc.metadata.get("title", "")
        url   = doc.metadata.get("source_url", "")
        body  = doc.page_content
        if title and url:
            parts.append(f"{body}\n(출처: {title} — {url})")
        elif title:
            parts.append(f"{body}\n(출처: {title})")
        else:
            parts.append(body)
    return "\n\n---\n\n".join(parts)


def _emergency_answer() -> str:
    """그래프 노드 내부 오류 발생 시 반환할 안전 메시지."""
    return (
        "안녕하세요, AI 선생님 '세이프'입니다. "
        "현재 학습 자료를 불러오는 중이거나 연결에 문제가 있어 답변을 드리기 어렵습니다. "
        "잠시 후 다시 질문해 주시거나, "
        "[금융감독원 금융교육포털](https://www.fss.or.kr/edu) 에서 도움을 받아 보세요."
    )


# ── 그래프 노드 ───────────────────────────────────────────────────────────────

async def retrieve(state: GraphState) -> dict:
    """
    노드 1 — FSS 검색
    match_knowledge_fss RPC 로 유사 문서를 검색합니다.
    오류가 발생해도 빈 리스트를 반환하고 그래프 진행을 유지합니다.
    """
    docs = await _search_fss(state["question"])
    print(f"[chatbot_graph] retrieve: {len(docs)}개 문서 검색됨")
    return {"source_docs": docs}


def route_decision(state: GraphState) -> dict:
    """
    노드 2 — 라우팅 판단
    source_docs 유무에 따라 route 값을 "rag" 또는 "fallback" 으로 결정합니다.
    실제 분기는 조건부 엣지 함수(should_fallback)가 담당합니다.
    """
    route = "fallback" if not state["source_docs"] else "rag"
    print(f"[chatbot_graph] route_decision: {route}")
    return {"route": route}


async def generate_rag(state: GraphState) -> dict:
    """
    노드 3 — RAG 답변 생성
    FSS 검색 문서를 컨텍스트로 삼아 LCEL 체인으로 답변을 생성합니다.
    """
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        context = _format_docs(state["source_docs"])
        prompt  = ChatPromptTemplate.from_messages([
            ("system", _SYSTEM_PROMPT),
            ("human",  "{question}"),
        ])
        chain  = prompt | _get_llm() | StrOutputParser()
        answer = await chain.ainvoke({
            "context":  context,
            "question": state["question"],
        })
    except Exception as exc:
        print(f"[chatbot_graph] generate_rag 오류: {exc}")
        answer  = _emergency_answer()
        context = ""

    sources: list[str] = list({
        doc.metadata["title"]
        for doc in state["source_docs"]
        if doc.metadata.get("title")
    })
    source_url: str | None = next(
        (doc.metadata["source_url"] for doc in state["source_docs"]
         if doc.metadata.get("source_url")),
        None,
    )

    return {
        "context":    context,
        "answer":     answer,
        "sources":    sources,
        "source_url": source_url,
    }


async def generate_fallback(state: GraphState) -> dict:
    """
    노드 4 — Fallback 답변 생성
    참조 자료 없이 일반 금융 지식 기반으로 LCEL 체인 답변을 생성합니다.
    """
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        prompt = ChatPromptTemplate.from_messages([
            ("system", _FALLBACK_SYSTEM_PROMPT),
            ("human",  "{question}"),
        ])
        chain  = prompt | _get_llm() | StrOutputParser()
        answer = await chain.ainvoke({"question": state["question"]})
    except Exception as exc:
        print(f"[chatbot_graph] generate_fallback 오류: {exc}")
        answer = _emergency_answer()

    return {
        "context":     "",
        "answer":      answer,
        "source_docs": [],
        "sources":     [],
        "source_url":  None,
    }


async def save_history(state: GraphState) -> dict:
    """
    노드 5 — 이력 저장
    chat_history 테이블에 상담 이력을 저장합니다.
    오류가 발생해도 로그만 출력하고 그래프를 정상 종료합니다.
    """
    try:
        supabase_admin.table("chat_history").insert({
            "user_id":    state["user_id"],
            "question":   state["question"],
            "answer":     state["answer"],
            "session_id": state["session_id"],
        }).execute()
    except Exception as exc:
        print(f"[chatbot_graph] chat_history 저장 오류: {exc}")

    return {"answered_at": datetime.now(tz=timezone.utc)}


# ── 조건부 엣지 함수 ──────────────────────────────────────────────────────────

def should_fallback(state: GraphState) -> str:
    """
    route_decision 이 설정한 state["route"] 값에 따라 다음 노드를 결정합니다.
    단순 if-else 가 아닌 LangGraph 조건부 엣지(.add_conditional_edges)로 등록됩니다.
    """
    return "generate_fallback" if state["route"] == "fallback" else "generate_rag"


# ── 그래프 컴파일 (지연 초기화 — 첫 호출 시 1회) ──────────────────────────────
# Render Free 512MB 환경에서 부팅 메모리를 줄이기 위해 langgraph import 자체를
# 첫 요청 시점까지 미룬다. 컴파일 결과는 _graph 모듈 변수에 캐시.

_graph: Any = None


def _get_graph():
    global _graph
    if _graph is None:
        from langgraph.graph import END, START, StateGraph
        _graph = (
            StateGraph(GraphState)
            .add_node("retrieve",          retrieve)
            .add_node("route_decision",    route_decision)
            .add_node("generate_rag",      generate_rag)
            .add_node("generate_fallback", generate_fallback)
            .add_node("save_history",      save_history)
            .add_edge(START,         "retrieve")
            .add_edge("retrieve",    "route_decision")
            .add_conditional_edges("route_decision", should_fallback)
            .add_edge("generate_rag",      "save_history")
            .add_edge("generate_fallback", "save_history")
            .add_edge("save_history",      END)
            .compile()
        )
    return _graph


# ── 공개 인터페이스 ───────────────────────────────────────────────────────────

async def ask_graph(
    question:   str,
    user_id:    str,
    session_id: str | None = None,
) -> dict:
    """
    LangGraph 챗봇 그래프를 실행하고 결과를 반환합니다.
    rag_chain.ask 와 동일한 반환 구조에 route 키가 추가됩니다.

    Parameters
    ----------
    question   : 사용자 질문
    user_id    : 인증된 사용자 ID
    session_id : 대화 세션 ID (None 이면 uuid4 자동 생성)

    Returns
    -------
    {
        "answer":      str,
        "session_id":  str,
        "sources":     list[str],
        "source_url":  str | None,
        "answered_at": datetime,
        "route":       str,   # "rag" | "fallback" | "error"
    }
    """
    if session_id is None:
        session_id = str(uuid.uuid4())

    initial_state: GraphState = {
        "question":    question,
        "user_id":     user_id,
        "session_id":  session_id,
        # 이하 각 노드가 채울 필드 — 초기 기본값
        "source_docs": [],
        "context":     "",
        "answer":      "",
        "route":       "",
        "sources":     [],
        "source_url":  None,
        "answered_at": datetime.now(tz=timezone.utc),
    }

    try:
        final_state: GraphState = await _get_graph().ainvoke(initial_state)
    except Exception as exc:
        # 그래프 자체가 중단된 최후의 경우
        print(f"[chatbot_graph] 그래프 실행 오류: {exc}")
        return {
            "answer":      _emergency_answer(),
            "session_id":  session_id,
            "sources":     [],
            "source_url":  None,
            "answered_at": datetime.now(tz=timezone.utc),
            "route":       "error",
        }

    return {
        "answer":      final_state["answer"],
        "session_id":  final_state["session_id"],
        "sources":     final_state["sources"],
        "source_url":  final_state["source_url"],
        "answered_at": final_state["answered_at"],
        "route":       final_state["route"],
    }
