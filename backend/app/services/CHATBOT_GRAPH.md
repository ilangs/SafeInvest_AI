# LangGraph 기반 RAG 챗봇 — 기술 정리

> SafeInvest AI 프로젝트의 신규 챗봇 엔진(`chatbot_graph.py`) 기술 문서.
> LangGraph StateGraph 로 RAG 우선 검색 + 자료 부족 시 LLM Fallback 분기를 구현.
> 발표 자료 작성용.

---

## 1. 왜 LangGraph 인가? (vs 기존 LCEL 단일 체인)

### 기존 `rag_chain.py` (LCEL 단일 파이프라인)
```
질문 → 임베딩 → RAG 검색 → 무조건 컨텍스트 주입 → LLM → 답변
```
- 장점: 코드 단순, LCEL 한 줄(`prompt | llm | parser`) 로 끝
- **한계**: 검색 결과가 비어도 그대로 LLM 에 빈 컨텍스트 주입 → 환각 위험
  - "참조 자료 없음" 메시지를 LLM 이 이해해야 fallback 가능 (불안정)
  - 분기 / 조건 / 상태 추적 / 노드별 에러 처리 어려움

### 신규 `chatbot_graph.py` (LangGraph StateGraph)
```
질문 → [retrieve] → [route_decision] ─조건분기─► [generate_rag]      → [save_history] → END
                                              └► [generate_fallback] ─┘
```
- **명시적 분기**: 검색 결과 유무에 따라 RAG / Fallback 노드를 다른 프롬프트로 분리
- **상태 추적**: `GraphState` 에 검색 결과, 라우트, 답변, 출처를 단계별로 누적 → 디버깅·관측성 ↑
- **확장 자유도**: 카테고리 라우팅, 의도 분류, 재시도 노드를 추가해도 그래프 수정만으로 가능
- **에러 격리**: 노드 단위 try-except → 한 노드 실패해도 그래프는 안전 종료

### LangGraph 핵심 개념
| 개념 | 의미 | 본 프로젝트 사용 |
|---|---|---|
| **StateGraph** | 노드들이 공유 State 를 주고받는 방향 그래프 | `GraphState(TypedDict)` |
| **Node** | 입력 State 를 받아 변경분 dict 를 반환하는 함수 | `retrieve`, `generate_rag`, ... |
| **Edge** | 노드 간 고정 연결 | `START → retrieve → route_decision` |
| **Conditional Edge** | State 값을 보고 다음 노드를 동적 결정 | `should_fallback(state) -> 'generate_rag' | 'generate_fallback'` |
| **Compile** | 그래프 정의를 실행 가능한 Runnable 로 변환 | `_graph = StateGraph(...).compile()` |

---

## 2. 그래프 아키텍처

```
                         ┌──────────────┐
                         │    START     │
                         └──────┬───────┘
                                ▼
                    ┌──────────────────────┐
                    │  retrieve            │   match_knowledge_fss RPC
                    │  (FSS 벡터 검색)     │   threshold=0.55, k=5
                    └──────────┬───────────┘
                               │ source_docs (List[Document])
                               ▼
                    ┌──────────────────────┐
                    │  route_decision      │   docs 비었으면 'fallback'
                    │  (라우트 결정)       │   있으면 'rag'
                    └──────────┬───────────┘
                               │
              ┌────────────────┴───────────────┐
              │     ★ 조건부 엣지              │
              │   should_fallback(state)       │
              └────┬───────────────────┬───────┘
                   │ "rag"             │ "fallback"
                   ▼                   ▼
        ┌──────────────────┐   ┌─────────────────────┐
        │  generate_rag    │   │ generate_fallback   │
        │  · 시스템프롬프트│   │ · 일반지식 안내     │
        │    + [참조 자료] │   │ · 면책 문구 부착    │
        │  · gpt-4o-mini   │   │ · gpt-4o-mini       │
        └─────────┬────────┘   └──────────┬──────────┘
                  │                       │
                  └───────────┬───────────┘
                              ▼
                    ┌──────────────────────┐
                    │  save_history        │   chat_history insert
                    │  (이력 저장)         │   answered_at 기록
                    └──────────┬───────────┘
                               ▼
                         ┌──────────┐
                         │   END    │
                         └──────────┘
```

---

## 3. State 스키마

LangGraph 의 핵심은 **노드 간에 흐르는 공유 State**. TypedDict 로 명시:

```python
class GraphState(TypedDict):
    # 입력
    question:    str
    user_id:     str
    session_id:  str
    # retrieve 노드가 채움
    source_docs: list[Document]
    # generate_* 노드가 채움
    context:     str
    answer:      str
    sources:     list[str]
    source_url:  str | None
    # route_decision 노드가 채움
    route:       str               # "rag" | "fallback"
    # save_history 노드가 채움
    answered_at: datetime
```

**핵심 규칙**: 각 노드는 **변경할 키만 dict 로 반환**하면 LangGraph 가 자동으로 State 에 머지함.

---

## 4. 노드별 책임

| 노드 | 입력 | 출력 (State 변경분) | 핵심 동작 |
|---|---|---|---|
| `retrieve` | `question` | `source_docs` | OpenAI 임베딩 → `match_knowledge_fss` RPC 호출 |
| `route_decision` | `source_docs` | `route` | 단순 유무 판정 (`"rag"` / `"fallback"`) |
| `generate_rag` | `source_docs`, `question` | `answer`, `sources`, `source_url`, `context` | 참조 자료 포함 LCEL 체인 실행 |
| `generate_fallback` | `question` | `answer`, `sources=[]`, 면책 문구 | 일반지식 LCEL 체인 실행 |
| `save_history` | `question`, `answer`, `user_id` | `answered_at` | `chat_history` 테이블 INSERT |

**조건부 엣지**:
```python
def should_fallback(state: GraphState) -> str:
    return "generate_fallback" if state["route"] == "fallback" else "generate_rag"

graph.add_conditional_edges("route_decision", should_fallback)
```

---

## 5. 검색 파라미터 — 임계값(Threshold) 의 의미

```python
async def _search_fss(question, k=5, threshold=0.55, category_codes=None):
    ...
    resp = supabase_admin.rpc("match_knowledge_fss", {
        "query_embedding": vector,
        "match_count":     k,           # 상위 K개
        "threshold":       threshold,   # 코사인 유사도 하한선
        "category_codes":  None,        # 전체 카테고리 검색
    }).execute()
```

| 파라미터 | 값 | 의미 |
|---|---|---|
| `k` | 5 | 상위 5개 청크만 컨텍스트로 사용 (LLM 토큰 절약) |
| `threshold` | **0.55** | 유사도 ≥ 0.55 인 청크만 채택 (그 이하는 노이즈로 간주 → fallback) |
| `category_codes` | None | 24개 카테고리 전체 검색 (향후 카테고리 라우팅 추가 시 활용) |

**임계값 튜닝 가이드** (운영 후 조정):
- 너무 자주 fallback 으로 빠짐 → 0.55 → 0.45 하향
- 엉뚱한 RAG 답변 발생 → 0.55 → 0.65 상향
- 일반적으로 한국어 임베딩 의미 매칭 적정선: **0.50 ~ 0.65**

---

## 6. 모델 선택 전략

```python
def _get_llm() -> ChatOpenAI:
    """RAG / Fallback 공용 — gpt-4o-mini 로 통일."""
    return ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
```

### 왜 gpt-4o-mini 인가
| 항목 | gpt-4o | **gpt-4o-mini (채택)** |
|---|---|---|
| 비용 | 1x | **약 1/15** |
| 속도 | 1x | 약 2~3x |
| 일반 추론 | 매우 강함 | 강함 |
| **RAG 시나리오** | 과한 사양 | **충분** — 정답이 컨텍스트에 이미 있음 |

**핵심 인사이트**: RAG 경로에서는 LLM 이 "지식을 생성"하지 않고 "컨텍스트를 정리·요약" 하는 역할이라
`gpt-4o-mini` 로도 품질 차이가 거의 없음. 운영 비용을 한 자릿수 분의 일로 줄임.

> 발표 포인트: **"좋은 검색 + 작은 모델 > 나쁜 검색 + 큰 모델"** — RAG의 본질.

---

## 7. 시스템 프롬프트 분리

```python
_SYSTEM_PROMPT          # RAG 경로: [참조 자료] {context} 포함, 출처 안내
_FALLBACK_SYSTEM_PROMPT # Fallback 경로: "관련 학습 자료를 찾지 못했습니다" 안내
                        #                + "※ 일반 정보입니다" 면책 문구
```

**분리 이유**:
- 단일 프롬프트로 분기 처리 시 LLM 이 "참조 자료 없음" 을 자주 무시함
- 프롬프트 자체를 다르게 주면 모델 행동이 결정적으로 달라짐 → **신뢰성 ↑**
- 운영 중 A/B 테스트 시 프롬프트 단위 비교 용이

---

## 8. 호출 인터페이스

### 외부 공개 함수
```python
async def ask_graph(
    question: str,
    user_id: str,
    session_id: str | None = None,
) -> dict:
    """
    Returns
    -------
    {
        "answer":      str,
        "session_id":  str,
        "sources":     list[str],   # 참조 청크 제목 (RAG 경로일 때만 채워짐)
        "source_url":  str | None,  # 출처 외부 링크 (있을 때만)
        "answered_at": datetime,
        "route":       str,         # "rag" | "fallback" | "error"
    }
    """
```

### 라우터 연결 ([routers/ai.py](../routers/ai.py))
```python
from app.services import chatbot_graph

@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, current_user: TokenData = Depends(get_current_user)):
    result = await chatbot_graph.ask_graph(
        question=body.question,
        user_id=current_user.user_id,
        session_id=body.session_id,
    )
    return ChatResponse(**result)
```

### 응답 스키마 ([schemas.py](../models/schemas.py))
```python
class ChatResponse(BaseModel):
    answer: str
    session_id: str
    sources: list[str] = Field(default_factory=list)
    source_url: str | None = None
    answered_at: datetime
    route: str | None = None    # ★ LangGraph 도입으로 추가
```

---

## 9. 안전성 설계 (Defensive Design)

LangGraph 구조 덕분에 **이중 안전망**이 자연스럽게 구현됨:

```
┌─────────────────────────────────────────┐
│  1차: 노드별 try-except                 │
│   - retrieve  실패 → 빈 docs 반환       │
│   - generate_*    실패 → 안전 메시지    │
│   - save_history 실패 → 로그만 출력    │
│  → 그래프는 항상 끝까지 진행             │
├─────────────────────────────────────────┤
│  2차: 그래프 전체 try-except            │
│   ainvoke 자체가 터지면                 │
│   → route="error" + 안전 메시지 반환    │
└─────────────────────────────────────────┘
```

**결과**: 어떤 상황에서도 사용자는 **HTTP 200 + 친절한 메시지** 를 받음 (500 에러 노출 없음).

---

## 10. 실행 흐름 예시 (실측)

### 케이스 A — RAG 적중
```
입력:  "분산투자가 뭔가요?"

[chatbot_graph] retrieve: 5개 문서 검색됨    (top_sim ≈ 0.78)
[chatbot_graph] route_decision: rag

응답:
{
  "answer": "분산투자는 위험을 줄이기 위해 여러 자산에 나눠 투자하는...",
  "sources": ["분산투자의 이해", "ETF로 시작하는 분산투자", ...],
  "source_url": "https://www.fss.or.kr/edu/...",
  "route": "rag"
}
```

### 케이스 B — Fallback
```
입력:  "오늘 점심 메뉴 추천해줘"

[chatbot_graph] retrieve: 0개 문서 검색됨    (모두 threshold 0.55 미달)
[chatbot_graph] route_decision: fallback

응답:
{
  "answer": "AI 선생님 '세이프'입니다. 저는 금융 관련 ...
             ※ 이 답변은 학습 자료 없이 생성된 일반 정보입니다.",
  "sources": [],
  "source_url": null,
  "route": "fallback"
}
```

### 케이스 C — Graph Error
```
[chatbot_graph] 그래프 실행 오류: ConnectionError(...)

응답:
{
  "answer": "현재 학습 자료를 불러오는 중이거나 ...
             [금융감독원 금융교육포털](...) 에서 도움을 받아 보세요.",
  "route": "error"
}
```

---

## 11. 향후 확장 포인트

LangGraph 구조라 다음 기능을 **노드 추가만으로** 구현 가능:

| 기능 | 추가 노드 | 위치 |
|---|---|---|
| 의도 분류 (off-topic 차단) | `classify_intent` | `START` 직후 |
| 카테고리 라우팅 | `classify_intent` 가 `category_codes` 채움 | retrieve 입력 |
| 신뢰도 재판정 (LLM-as-judge) | `judge_relevance` | `route_decision` 다음 |
| 웹 검색 fallback | `web_search` | `generate_fallback` 직전 |
| 출처 rerank (Cohere) | `rerank` | `retrieve` 직후 |
| 멀티턴 대화 메모리 | `load_history` / `save_history` 확장 | `START` / `END` |

기존 코드 수정 없이 그래프 정의부만 변경 → **유지보수 비용 최소화**.

---

## 12. 발표용 핵심 메시지

1. **"분기가 있는 챗봇은 그래프로"** — LCEL 단일 파이프라인의 한계를 LangGraph 가 해결.
2. **상태(State) 가 자동 누적** → 노드 간 데이터 전달이 명시적·관측 가능.
3. **검색 실패 ≠ 답변 실패** — 자동 fallback 으로 사용자 경험 보호.
4. **"좋은 검색 + 작은 모델" 전략** — `gpt-4o-mini` + threshold 0.55 로 비용 1/15 + 속도 2~3배.
5. **이중 try-except** — 어떤 노드가 죽어도 사용자는 친절한 메시지 수신, 500 에러 0건.
6. **확장은 노드 추가만으로** — 카테고리 라우팅, 의도 분류, rerank 등 무수정 확장.

---

## 13. 디렉토리 구조

```
backend/
├── app/
│   ├── routers/
│   │   └── ai.py                    # POST /api/v1/ai/chat → ask_graph 호출
│   ├── models/
│   │   └── schemas.py               # ChatResponse (route 필드 포함)
│   └── services/
│       ├── rag_chain.py             # 기존 LCEL 단일 체인 (백업/롤백용)
│       ├── chatbot_graph.py         # ★ 신규 LangGraph 엔진
│       └── CHATBOT_GRAPH.md         # 본 문서
├── schema/
│   └── migration_09_add_fss_rag.sql # FSS 테이블 + match_knowledge_fss RPC
└── scripts/
    ├── seed_fss_contents.py         # FSS JSON → 청크/임베딩 적재
    ├── PROMPT_langgraph_chatbot.md  # 본 그래프 구현용 바이브 코딩 프롬프트
    └── TECH_pgvector_rag.md         # pgvector 데이터 파이프라인 기술 정리
```
