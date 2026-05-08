# pgvector 기반 RAG 데이터 파이프라인 — 기술 정리

> SafeInvest AI 프로젝트에서 금감원(FSS) 금융교육 콘텐츠 802건을 RAG DB로 적재하면서
> 적용한 기술 내용 정리. 발표 자료 작성용.
> 작성일: 2026-05-08 / 적재 결과: 802 콘텐츠 → 3,752 청크 / 임베딩 OpenAI text-embedding-3-small (1536d)

---

## 1. RAG 와 pgvector 한 장 요약

### RAG (Retrieval-Augmented Generation) 란
- LLM 답변 직전에 **외부 지식 베이스에서 관련 자료를 검색**하여 프롬프트에 주입하는 패턴
- 학습되지 않은 도메인 지식(금감원 자료 등)을 LLM 에 "주입"하는 표준 방법
- 환각(hallucination) 감소 + 출처 표시 가능 + LLM 재학습 불필요

### pgvector 란
- **PostgreSQL 의 벡터 검색 확장**(`CREATE EXTENSION vector`)
- `VECTOR(n)` 컬럼 타입과 거리 연산자(`<->`, `<=>`, `<#>`) 제공
- 인덱스: `ivfflat` (근사, 빠름), `hnsw` (정확, 메모리 더 사용)
- Supabase 가 기본 제공 → 별도 벡터 DB(Pinecone, Weaviate) 없이 단일 스택 운영 가능

### 왜 pgvector를 선택했나
| 후보 | 장점 | 단점 |
|---|---|---|
| **pgvector (채택)** | 기존 Supabase 재사용, 관계형 데이터와 JOIN 가능, 무료 | 초대규모(1억+) 시 성능 한계 |
| Pinecone / Weaviate | 대규모 최적화, 하이브리드 점수 튜닝 | 별도 인프라/비용, 이중 관리 |
| Chroma / FAISS 로컬 | 빠른 PoC | 영속성·동시성·백업 직접 처리 |

→ 1만 청크 규모, 이미 Supabase 쓰는 환경 → **pgvector 가 최적**

---

## 2. 시스템 아키텍처

```
                     ┌───────────────────────────────────────┐
   real_contents.json│ ① 전처리 (clean_html)                 │
   (28MB, 1345건)   →│ ② 중복 제거 (contents_slno 기준)      │
                     │ ③ 청킹 (RecursiveSplitter 700/100)    │
                     │ ④ OpenAI 임베딩 (1536d 배치 64)       │
                     │ ⑤ Supabase upsert                     │
                     └─────────────────┬─────────────────────┘
                                       ▼
   ┌───────────────────────────────────────────────────────────┐
   │  Supabase (PostgreSQL + pgvector)                          │
   │                                                             │
   │   fss_contents (802 rows)            knowledge_chunks       │
   │   ┌─────────────────────┐           (3,752 rows, FSS)      │
   │   │ contents_slno (PK)   │           ┌─────────────────┐  │
   │   │ category_code       │ 1 : N     │ id              │  │
   │   │ raw_html / plain    │ ─────→    │ content (청크)   │  │
   │   │ chunk_count         │ metadata  │ source='FSS'    │  │
   │   │ embedded_at         │  .slno    │ metadata JSONB  │  │
   │   └─────────────────────┘           └────────┬────────┘  │
   │                                              │ 1 : 1     │
   │                                              ▼            │
   │                                     knowledge_embeddings  │
   │                                     ┌─────────────────┐  │
   │                                     │ embedding       │  │
   │                                     │   VECTOR(1536)  │  │
   │                                     │ ivfflat 인덱스  │  │
   │                                     └─────────────────┘  │
   └───────────────────────────────────────────────────────────┘
                                       ▲
                                       │ match_knowledge_fss(...)
                                       │ (Cosine similarity Top-K)
   ┌───────────────────────────────────┴────────────────────────┐
   │  RAG 체인 / LangGraph 챗봇                                  │
   │  질문 → 임베딩 → Top-K 검색 → 컨텍스트 주입 → GPT-4o 답변   │
   └─────────────────────────────────────────────────────────────┘
```

### 설계 핵심 결정

1. **2-table 분리** — 원본 메타(`fss_contents`)와 검색 청크(`knowledge_chunks`) 분리
   - 원본 보존 + 출처 카드 렌더링 + 재청킹 자유도 확보
2. **기존 RAG 인터페이스 재사용** — 신규 콘텐츠도 `source='FSS'` 태그로 동일 RPC(`match_knowledge`)에서 검색
3. **`metadata` JSONB 활용** — 카테고리 코드, 청크 인덱스 등을 유연하게 저장 (스키마 변경 없이 확장)

---

## 3. 데이터베이스 스키마 (핵심 SQL)

### 3-1. 확장 활성화
```sql
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS moddatetime;  -- updated_at 자동 갱신
```

### 3-2. 원본 메타 테이블
```sql
CREATE TABLE fss_contents (
    contents_slno   TEXT PRIMARY KEY,
    category_code   TEXT NOT NULL,
    title           TEXT,
    raw_html        TEXT,            -- 원문 보존
    plain_text      TEXT,            -- 정제된 본문
    chunk_count     INT  DEFAULT 0,
    embedded_at     TIMESTAMPTZ,     -- NULL = 미완료 (resume 용)
    ...
);
```

### 3-3. 청크 + 벡터 테이블
```sql
CREATE TABLE knowledge_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content     TEXT NOT NULL,
    source      TEXT,              -- 'FSS' 로 태깅
    metadata    JSONB,             -- {contents_slno, category_code, chunk_idx}
    ...
);

CREATE TABLE knowledge_embeddings (
    chunk_id    UUID NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    embedding   VECTOR(1536) NOT NULL  -- ★ pgvector 핵심
);
```

### 3-4. 벡터 인덱스
```sql
CREATE INDEX idx_knowledge_vector
    ON knowledge_embeddings
    USING ivfflat (embedding vector_cosine_ops)  -- 코사인 거리
    WITH (lists = 100);                           -- 클러스터 수
```

| 항목 | 설명 |
|---|---|
| `ivfflat` | Inverted File with Flat compression — 데이터를 N개 클러스터로 나눠 탐색 |
| `vector_cosine_ops` | 코사인 거리 연산자 클래스 (방향성 비교, 텍스트 임베딩 표준) |
| `lists = 100` | 클러스터 수. 일반적으로 `√(rows)` ~ `rows/1000` 권장. 3,752건엔 100이 적정 |

### 3-5. 검색 함수 (RPC)
```sql
CREATE FUNCTION match_knowledge_fss(
    query_embedding VECTOR(1536),
    match_count     INT DEFAULT 5,
    threshold       FLOAT DEFAULT 0.3
) RETURNS TABLE (...)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT kc.id, kc.content, kc.title,
           1 - (ke.embedding <=> query_embedding) AS similarity
    FROM knowledge_embeddings ke
    JOIN knowledge_chunks     kc ON ke.chunk_id = kc.id
    WHERE kc.source = 'FSS'
      AND (1 - (ke.embedding <=> query_embedding)) >= threshold
    ORDER BY ke.embedding <=> query_embedding   -- ★ 인덱스 활용
    LIMIT match_count;
END;
$$;
```

#### pgvector 거리 연산자
| 연산자 | 의미 | 사용 사례 |
|---|---|---|
| `<->` | L2 거리 (유클리드) | 좌표 등 절대 거리 |
| `<=>` | **코사인 거리** | **텍스트 임베딩 (채택)** |
| `<#>` | 내적 (음수) | 정규화된 벡터의 빠른 비교 |

`similarity = 1 - (a <=> b)` → **0 (무관) ~ 1 (완전 일치)** 의 직관적 점수로 변환

---

## 4. 데이터 전처리 파이프라인

### 4-1. HTML 정제
FSS 원문은 `&lt;p&gt;` 인코딩, `rn` 잔존 토큰, `&nbsp;` 다중 공백, 인라인 style 등 잡음이 많음.

```python
def clean_html(raw: str) -> str:
    text = html.unescape(raw)               # &lt; → <
    text = re.sub(r"\brn\b", "\n", text)    # 'rn' 토큰 → 개행
    soup = BeautifulSoup(text, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\[?\s*동영상\s*자막\s*\]?", "", text)  # 자막 헤더 제거
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
```

### 4-2. 청킹 (Chunking) 전략
```python
RecursiveCharacterTextSplitter(
    chunk_size=700,
    chunk_overlap=100,
    separators=["\n\n", "\n", "。", ". ", "! ", "? ", " ", ""],
)
```

| 파라미터 | 값 | 근거 |
|---|---|---|
| `chunk_size` | 700자 | 한국어 ≈ 350~500 토큰. text-embedding-3-small 8192 토큰 한도 내 안전 + 의미 단위 보존 |
| `chunk_overlap` | 100자 | 청크 경계에서 의미 단절 방지 (앞 청크 끝 100자가 다음 청크에 포함) |
| `separators` | 단락→문장→공백 순 | 의미 단위 우선 분할, 깨지면 점진적 fallback |

**왜 재귀(Recursive) 인가?**
- 첫 separator(`\n\n`)로 단락 분할 시도
- 청크가 너무 크면 다음 separator(`\n`)로 재귀 분할
- 모든 separator 가 실패해야 강제 자르기 → **자연스러운 경계 유지**

### 4-3. 중복 제거 (실전 트랩)
FSS JSON 은 동일 `contentsSlno` 가 다중 카테고리 배열에 중복 등장 (1,345 → 802 unique).
PostgreSQL 의 `ON CONFLICT DO UPDATE` 는 한 INSERT 문 안에 같은 PK 가 두 번 나오면 거부.

```python
# 적재 직전 dict 화로 dedup
deduped = {}
for r in rows:
    deduped[r["contents_slno"]] = r   # 마지막에 본 row 유지
rows = list(deduped.values())
```

### 4-4. 임베딩 (배치 + 재시도)
```python
for start in range(0, len(chunks), 64):           # 배치 64
    batch = chunks[start:start+64]
    for attempt in range(3):                       # 지수 백오프
        try:
            resp = openai.embeddings.create(
                model="text-embedding-3-small",
                input=[c.content for c in batch],
            )
            break
        except Exception:
            time.sleep(2 ** attempt)               # 1s → 2s → 4s
```

| 항목 | 설명 |
|---|---|
| 모델 | `text-embedding-3-small` (1536d) — `large` 대비 1/5 비용, 품질 충분 |
| 배치 크기 64 | OpenAI 제한 2048개/요청 안전 + 토큰 한도 내 + 적당한 throughput |
| 재시도 3회 | 429 / 일시적 네트워크 오류 자동 복구 |

---

## 5. 적재 결과 (실측)

| 지표 | 값 |
|---|---|
| 원본 콘텐츠 | 1,345건 (24개 카테고리) |
| 중복 제거 후 | 802건 |
| 본문 없음 스킵 | 88건 |
| 실제 임베딩 콘텐츠 | 714건 |
| 생성 청크 수 | **3,752개** |
| 평균 청크/콘텐츠 | 5.25개 |
| 원본 본문 총량 | ~22.9MB plain text |
| 임베딩 차원 | 1,536 |
| 임베딩 데이터 크기 | 3,752 × 1,536 × 4byte ≈ **23MB** |
| 소요 시간 | **약 5분** (네트워크 중심) |
| OpenAI 비용 | ~$1 미만 |

---

## 6. 검색 동작 원리 (질의 시점)

```python
# 1. 질문을 동일 모델로 임베딩
query_vec = openai.embeddings.create(
    model="text-embedding-3-small",
    input=["분산투자가 뭔가요?"]
).data[0].embedding   # 1536d 벡터

# 2. pgvector 코사인 거리 검색 (인덱스 활용)
result = supabase.rpc("match_knowledge_fss", {
    "query_embedding": query_vec,
    "match_count": 5,
    "threshold": 0.5,
}).execute()

# 3. 상위 5개 청크를 LLM 프롬프트의 [참조 자료] 섹션에 주입
```

**의미 검색이 키워드 검색보다 강한 이유**
- 키워드 검색: "분산투자" 라는 정확한 단어가 본문에 있어야 매칭
- 벡터 검색: "위험 줄이려면 어떻게?" 같은 의역 질문도 분산투자 자료를 찾아냄
- → 임베딩 공간에서 **의미가 비슷하면 가까운 위치** 에 매핑되기 때문

---

## 7. 운영 모니터링

```sql
-- 카테고리별 적재 현황 뷰
SELECT * FROM v_fss_ingest_status;

-- 결과 예시
-- category_code | total | embedded | total_chunks | last_embedded_at
-- 2001          | 78    | 70       | 360          | 2026-05-08 ...
-- 2002          | 65    | 58       | 290          | 2026-05-08 ...
```

미완료 항목만 재처리:
```bash
python scripts/seed_fss_contents.py --resume
```

---

## 8. 한계와 향후 개선

| 현재 한계 | 개선 방안 |
|---|---|
| 단순 벡터 검색 (의역엔 강하지만 정확 키워드 매칭 약함) | **하이브리드 검색**: pgvector + Postgres FTS(`tsvector`) 점수 결합 |
| `ivfflat` 는 인덱스 빌드 시점 이후 추가 데이터에 약간의 정확도 손실 | 데이터 1만 건 돌파 시 `hnsw` 인덱스로 전환 검토 |
| 카테고리 다중 매핑 손실 (현재는 마지막 카테고리만) | `fss_contents.category_codes TEXT[]` 컬럼 추가 |
| Top-K 재정렬(rerank) 없음 | Cohere Rerank / cross-encoder 도입 시 정확도 향상 |
| 청크 단위 검색이라 긴 문맥 손실 가능 | Parent Document Retrieval (청크 → 원본 문단 역참조) |

---

## 9. 발표용 핵심 메시지

1. **"단일 스택" 의 위력** — Supabase 한 곳에서 사용자 데이터 + 벡터 검색 + RAG 운영. 별도 벡터 DB 비용/관리 0.
2. **"의미" 로 찾는 검색** — 키워드 일치 없이도 질문의 의도와 가까운 자료 추출. LLM 정확도의 출발점.
3. **"청킹 전략" 이 RAG 품질의 절반** — 너무 크면 노이즈, 너무 작으면 문맥 손실. 700/100 + 한국어 separator 가 실측 균형점.
4. **"메타 분리" 설계** — 검색용 청크와 출처 메타를 분리하여 출처 카드 UI · 재청킹 자유도 · 부분 갱신 모두 가능.
5. **실측 비용** — 802 콘텐츠 / 3,752 청크 / 5분 / $1 미만 → **소규모 조직에서도 즉시 도입 가능**한 수준.

---

(끝) 발표 자료에 인용 시 SafeInvest AI 프로젝트 적용 사례로 표기하면 됨.
