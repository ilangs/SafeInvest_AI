# SafeInvest AI — Backend

> **버전** : 1.0.0 (Phase 4 완료)  
> **배포** : Render.com  
> **Python** : 3.12 | **FastAPI** : 0.136 | **LangChain** : 0.3.25

---

## 폴더 구조

```
backend/
├── main.py                         # FastAPI 앱 진입점, 라우터 등록, CORS
│
├── app/
│   ├── core/
│   │   ├── config.py               # Pydantic-Settings 환경변수 (settings 싱글턴)
│   │   ├── supabase.py             # Supabase 클라이언트 (anon / admin)
│   │   └── security.py             # JWT 검증 SSOT
│   │
│   ├── routers/
│   │   ├── auth.py                 # GET  /api/v1/auth/verify
│   │   ├── market.py               # GET  /api/v1/market/quote?symbol=
│   │   ├── order.py                # POST /api/v1/order
│   │   ├── ai.py                   # POST /api/v1/ai/chat
│   │   ├── watchlist.py            # GET/POST/DELETE /api/v1/watchlist
│   │   ├── account.py              # GET /api/v1/account/balance|holdings
│   │   └── portfolio.py            # GET /api/v1/portfolio/analysis
│   │
│   ├── services/
│   │   ├── kis_client.py           # KIS REST API (모의/실전 자동 전환)
│   │   └── rag_chain.py            # LangChain LCEL RAG + 세이프 튜터 페르소나
│   │
│   ├── models/
│   │   └── schemas.py              # Pydantic v2 요청/응답 스키마
│   │
│   └── dependencies.py             # get_current_user (Depends 주입)
│
├── schema/
│   ├── init.sql                    # Supabase DB 초기화 v2.0 (8 테이블 + RLS + pgvector)
│   └── migrate_v1_to_v2.sql        # v1 → v2 마이그레이션
│
├── scripts/
│   └── seed_knowledge.py           # 지식 DB 초기 데이터 10건 시딩
│
├── tests/
│   ├── test_health.py              # 헬스체크 + 인증 단위 테스트 (3개)
│   └── test_scenarios.py           # 전체 시나리오 통합 테스트 (9개)
│
├── requirements.txt                # 핵심 패키지 버전 고정
├── Procfile                        # Render.com 시작 명령
├── render.yaml                     # Render.com 배포 설정
├── RENDER_ENV_CHECKLIST.md         # Render 환경변수 체크리스트
└── REAL_TRADING_GUIDE.md           # 실전 거래 전환 가이드
```

---

## 엔드포인트 목록

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/health` | ❌ | 서버 상태 + KIS 모드 확인 |
| GET | `/docs` | ❌ | Swagger UI |
| GET | `/api/v1/auth/verify` | ✅ | JWT 토큰 유효성 검증 |
| GET | `/api/v1/market/quote` | ✅ | 주식 현재가 조회 (`?symbol=005930`) |
| POST | `/api/v1/order` | ✅ | 주식 매수/매도 주문 |
| POST | `/api/v1/ai/chat` | ✅ | AI 투자 튜터 채팅 (RAG) |
| GET | `/api/v1/watchlist` | ✅ | 관심종목 목록 조회 |
| POST | `/api/v1/watchlist` | ✅ | 관심종목 추가 |
| DELETE | `/api/v1/watchlist/{code}` | ✅ | 관심종목 삭제 |
| GET | `/api/v1/account/balance` | ✅ | 계좌 잔고 조회 |
| GET | `/api/v1/account/holdings` | ✅ | 보유종목 조회 |

---

## 빠른 시작 (로컬)

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 열어서 실제 키 입력
```

필수 키: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,  
`SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`, `KIS_APP_KEY`, `KIS_APP_SECRET`,  
`KIS_ACCOUNT`, `KIS_MOCK=true`, `FASTAPI_SECRET_KEY`

### 2. 의존성 설치

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. DB 초기화 (Supabase)

Supabase Dashboard → SQL Editor 에서 순서대로 실행:
1. `schema/init.sql` (최초 실행 또는 클린 셋업)
2. `schema/migrate_v1_to_v2.sql` (기존 v1 DB 업그레이드 시)
3. `scripts/seed_knowledge.py` (지식 DB 초기 데이터)

```bash
PYTHONPATH=. python scripts/seed_knowledge.py
```

### 4. 서버 실행

```bash
cd backend
PYTHONPATH=. ../.venv/Scripts/uvicorn main:app --reload --port 8000
```

### 5. 테스트

```bash
cd backend
PYTHONPATH=. ../.venv/Scripts/pytest tests/ -v
# 목표: 12/12 통과
```

---

## 기술 스택

| 항목 | 사용 기술 |
|------|-----------|
| 웹 프레임워크 | FastAPI 0.136 + Uvicorn |
| 스키마 검증 | Pydantic v2 + pydantic-settings |
| DB / Auth | Supabase (PostgreSQL + pgvector + RLS) |
| AI / RAG | LangChain 0.3.25 LCEL + OpenAI text-embedding-3-small |
| 주식 API | KIS (한국투자증권) REST API |
| 인증 | Supabase JWT (PyJWT 검증) |

---

## 주요 원칙

| 항목 | 원칙 |
|------|------|
| **환경변수** | `os.environ` 직접 읽기 금지 → `from app.core.config import settings` |
| **JWT 검증** | `app/core/security.py` 의 `verify_jwt()` 만 사용 |
| **LangChain** | LCEL 방식만 허용, 구버전 `RetrievalQA` 금지 |
| **Supabase 쓰기** | `supabase_admin` (service_role) 만 INSERT/UPDATE |
| **RAG 검색** | `supabase_admin.rpc('match_knowledge')` 직접 호출 (SupabaseVectorStore 미사용) |
| **KIS 모드** | `KIS_MOCK=true` 유지 후 실전 전환 시 `REAL_TRADING_GUIDE.md` 참조 |

---

*SafeInvest AI Backend v1.0.0 | PHASE 4 완료*
