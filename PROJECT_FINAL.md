# SafeInvest AI — 프로젝트 최종 문서

---

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [주요 기능](#3-주요-기능)
4. [핵심 파일 12개 소개](#4-핵심-파일-12개-소개)
5. [기술 스택](#5-기술-스택)
6. [데이터베이스 스키마](#6-데이터베이스-스키마)
7. [DB 마이그레이션 실행 순서](#7-db-마이그레이션-실행-순서)
8. [환경 변수](#8-환경-변수)
9. [로컬 실행](#9-로컬-실행)
10. [배포](#10-배포)
11. [보안 체크리스트](#11--보안-체크리스트)
12. [알려진 한계와 향후 계획](#12-알려진-한계와-향후-계획)

---

## 1. 프로젝트 개요

**SafeInvest AI** 는 한국 개인투자자, 특히 초보 투자자를 위한 **건전 투자 가이드 플랫폼**입니다.

### 목표
- 투자 입문자가 안전하게 주식을 시작할 수 있도록 교육·분석·매매를 한 곳에 통합
- 모의투자(KIS)로 무위험 학습 → 자신감 생기면 실거래 전환
- AI 챗봇 + RAG 기반 신뢰할 수 있는 금융 지식 제공
- 종목 안전성 스코어로 위험 종목 사전 경고

### 타겟 사용자
- 주식을 처음 시작하는 청년·중장년
- 투자 용어와 차트 분석을 기초부터 배우고 싶은 사람
- KIS 모의계좌로 실전 감각을 익히고 싶은 사람

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                          사용자 브라우저                          │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTPS
┌────────────────────────────────▼────────────────────────────────┐
│           Frontend (Vercel — React 19 + Vite + PWA)              │
│  • 매매 · 시장분석 · AI 챗봇 · 교육센터 · 마이페이지              │
└────────────────────────────────┬────────────────────────────────┘
                                 │ REST + JWT
┌────────────────────────────────▼────────────────────────────────┐
│            Backend (Render — FastAPI + Uvicorn)                  │
│  ├─ Routers : auth · market · order · ai · account · credentials │
│  │            stocks · watchlist · study_logs · education        │
│  ├─ Services: kis_client · rag_chain · chatbot_graph             │
│  └─ Core    : security(JWT) · encryption(AES-256) · config       │
└──────┬───────────────────┬─────────────────────┬────────────────┘
       │                   │                     │
       ▼                   ▼                     ▼
┌─────────────┐   ┌─────────────────┐   ┌─────────────────────┐
│ KIS API     │   │ OpenAI API      │   │ Supabase            │
│ (한국투자증권)│   │ (embedding+LLM) │   │ Postgres + pgvector │
│             │   │                 │   │ + Auth + RLS        │
└─────────────┘   └─────────────────┘   └──────────┬──────────┘
                                                   │
                                  ┌────────────────┴────────────────┐
                                  │ analysis/daily_update.py        │
                                  │ KRX + DART + KIS → DB 적재      │
                                  └─────────────────────────────────┘
```

---

## 3. 주요 기능

### 3.1 매매 (`/trade`)
- 종목 검색 · 자동완성 · 시장/업종 표시
- 실시간 캔들 차트 + MA5/20/60 + 거래량
- KIS 호가창 (10단계) + 클릭 시 가격 자동 입력
- 모의/실거래 매수·매도 (지정가·시장가)
- **거래시간 외 주문 자동 차단** (주말·공휴일·정규장 외)
- 잔고·보유종목·매매내역 자동 로드 + 사용자별 마지막 종목 복원
- 첫 진입 시 보유종목 최상단 자동 선택

### 3.2 시장분석 (`/analysis`)
- 종목 안전성 스코어 (재무·수익성·거래 활성도)
- 위험 신호 4종: 자본잠식·연속적자·고부채·매출부족
- 재무제표 차트 + 가격 시계열
- AI 분석 (1-Click)
- 최근 조회 종목 빠른 접근

### 3.3 AI 챗봇 (`/ai-chat`)
- LangGraph 기반 멀티스텝 챗봇
- FSS 금융교육 자료 RAG (출처 명시)
- 답변에 출처 URL 첨부, 안전 튜터 페르소나
- chat_history 자동 저장

### 3.4 교육센터 (`/education`)
- 초보 가이드 + 4단계 기본기 영상 (21편)
- **주디 백과사전**: 230개 주식·투자 용어, 17개 카테고리, 초성 검색
- FSS 교육 콘텐츠 통합

### 3.5 마이페이지 (`/mypage`)
- KIS 계좌 연결 (AES-256 암호화 저장)
- 학습 기록 · 관심종목 관리

---

## 4. 핵심 파일 12개 소개

처음 보는 사람도 시스템 구조를 빠르게 이해할 수 있는 대표 파일 12개입니다.
각 파일 상단에 상세한 설명 주석이 추가되어 있습니다.

| # | 파일 | 분류 | 역할 |
|---|---|---|---|
| 1 | [`backend/main.py`](backend/main.py) | 진입점 | FastAPI 앱 조립 — 라우터 통합·CORS·정적파일·헬스체크 |
| 2 | [`backend/app/core/security.py`](backend/app/core/security.py) | 보안 | JWT 검증 SSOT — Supabase ES256/HS256 자동 분기 |
| 3 | [`backend/app/core/encryption.py`](backend/app/core/encryption.py) | 보안 | KIS 자격증명 AES-256 (Fernet) 암복호화 |
| 4 | [`backend/app/routers/credentials.py`](backend/app/routers/credentials.py) | 보안 | KIS API 키 등록·검증·삭제 (암호화 후 저장) |
| 5 | [`backend/app/services/kis_client.py`](backend/app/services/kis_client.py) | 핵심 | 한국투자증권 API 통합 — 시세·주문·잔고·옵티미스틱 동기화 |
| 6 | [`backend/app/services/rag_chain.py`](backend/app/services/rag_chain.py) | AI | LangChain LCEL RAG — 단일 질의 응답 체인 |
| 7 | [`backend/app/services/chatbot_graph.py`](backend/app/services/chatbot_graph.py) | AI | LangGraph 멀티 노드 챗봇 — retrieve → route → generate → save |
| 8 | [`backend/app/routers/order.py`](backend/app/routers/order.py) | 매매 | 주문 엔드포인트 (거래시간 차단·rejected 상태 명시 응답) |
| 9 | [`backend/analysis/daily_update.py`](backend/analysis/daily_update.py) | 데이터 | 일일 데이터 파이프라인 — KRX/DART/KIS → Supabase |
| 10 | [`frontend/src/pages/TradePage.jsx`](frontend/src/pages/TradePage.jsx) | UI | 매매 대시보드 — 8개 위젯 통합 (가장 종합적) |
| 11 | [`frontend/src/pages/MarketAnalysisPage.jsx`](frontend/src/pages/MarketAnalysisPage.jsx) | UI | 시장분석 — 안전성 스코어·위험 신호 |
| 12 | [`frontend/src/components/education/StockDictionary.jsx`](frontend/src/components/education/StockDictionary.jsx) | UI | 주디 백과사전 — 230개 용어, 초성 검색 |

---

## 5. 기술 스택

### Frontend
| 항목 | 기술 |
|---|---|
| 프레임워크 | React 19 + Vite 8 |
| 라우팅 | react-router-dom 7 |
| 차트 | lightweight-charts 5, chart.js 4 |
| 상태 | 로컬 useState/useReducer + Supabase JS SDK |
| PWA | vite-plugin-pwa |
| 마크다운 | react-markdown + remark-gfm |
| 배포 | Vercel |

### Backend
| 항목 | 기술 |
|---|---|
| 웹 프레임워크 | FastAPI 0.136 + Uvicorn |
| 스키마 | Pydantic v2 + pydantic-settings |
| AI / RAG | LangChain 0.3.25 LCEL + LangGraph 0.6 |
| 임베딩 | OpenAI text-embedding-3-small (1536-dim) |
| LLM | OpenAI gpt-4o-mini (대화), gpt-4o (큐레이션) |
| 주식 API | KIS (한국투자증권) |
| 데이터 소스 | KRX, DART OpenAPI |
| 암호화 | cryptography Fernet (AES-256) |
| 스케줄러 / 워크플로우 | GitHub Actions (`keep_alive.yml`, `daily_update.yml`) |
| 배포 | Render.com |

### DB / Auth
| 항목 | 기술 |
|---|---|
| DB | Supabase Postgres |
| 벡터 검색 | pgvector |
| Auth | Supabase Auth (JWT ES256/HS256) |
| 보안 | Row Level Security (RLS) 정책 |

---

## 6. 데이터베이스 스키마

### 주요 테이블

| 테이블 | 용도 | 핵심 컬럼 |
|---|---|---|
| `auth.users` | Supabase 인증 사용자 | id, email |
| `user_kis_credentials` | 사용자별 KIS API 키 (암호화) | user_id, is_mock, enc_app_key, enc_app_secret, enc_account_no |
| `user_orders` | 매매 주문 로그 | user_id, is_mock, order_type, status, order_id_ext |
| `stocks` | 종목 마스터 | ticker, stock_name, market, sector, industry |
| `stock_prices` | 일별 OHLCV | ticker, trade_date, close_price, volume |
| `stock_financials` | 분기 재무제표 | ticker, fiscal_year, fiscal_quarter, net_income, total_assets |
| `stock_warnings` | 위험 신호 | ticker, warning_type, is_active |
| `stock_terms` | 주식·투자 용어 사전 (230개) | id, term, category, importance, description |
| `knowledge_chunks` | RAG 문서 청크 | id, source, content, metadata |
| `knowledge_embeddings` | pgvector 임베딩 | chunk_id, embedding (1536-dim) |
| `fss_contents` | FSS 금융교육 콘텐츠 메타 | contents_slno, category_code, title |
| `chat_history` | 챗봇 대화 기록 | user_id, role, content, source_docs |
| `watchlist` | 관심종목 | user_id, ticker |
| `recent_searches` | 최근 조회 | user_id, ticker, searched_at |
| `study_logs` | 학습 기록 | user_id, content_id, completed_at |

### 핵심 RPC 함수
- `match_knowledge(query_embedding, threshold, match_count)` — 일반 RAG 검색
- `match_knowledge_fss(query_embedding, threshold, match_count, category_codes)` — FSS 전용 검색
- `increment_view_count(term_id)` — 용어 조회수 +1

---

## 7. DB 마이그레이션 실행 순서

[`backend/schema/`](backend/schema/) 의 **5개 SQL 파일**을 순서대로 실행하면
DB 전체(21테이블 + 8함수 + 1뷰 + RLS 정책 + 트리거)가 구축됩니다.

| 순서 | 파일 | 모듈 | 핵심 내용 |
|---|---|---|---|
| 1 | `schema/01_foundation.sql` | 기반 시설 | 확장(uuid-ossp/vector/moddatetime) + 공통 트리거 + user_profiles/settings/watchlist + 신규가입 자동 트리거 |
| 2 | `schema/02_kis_credentials.sql` | 🔐 보안 | user_kis_credentials (AES-256 암호화 저장) |
| 3 | `schema/03_trading.sql` | 매매 | user_orders (옵티미스틱 잔고 패턴) |
| 4 | `schema/04_market_analysis.sql` | 시장분석 | stocks/prices/financials/warnings + recent_searches + collection_log + 품질검증 + QC 함수 3개 |
| 5 | `schema/05_ai_education.sql` | AI · 교육 | chat_history + knowledge_chunks/embeddings + fss_contents + stock_terms + study_logs + 검색 RPC 3개 |

각 파일 끝의 `SELECT 'installed' AS result;` 메시지로 정상 실행 확인.
의존관계·검증쿼리·문제해결은 [`backend/schema/README.md`](backend/schema/README.md) 참조.

### 시드 데이터 적재 (Python)
```bash
cd backend
python scripts/seed_stock_data.py              # 종목 마스터 (KOSPI/KOSDAQ)
python scripts/seed_knowledge.py               # RAG 지식 시드
python scripts/seed_fss_contents.py            # FSS 금감원 콘텐츠 (선택)
python scripts/upsert_new_terms.py --apply     # 주식 백과사전 230개

# 일일 데이터 1회 수집 (KIS + DART)
cd analysis && python daily_update.py
```

---

## 8. 환경 변수

### Backend `.env` (점검 완료 — 누락 없음)

| 키 | 필수 | 용도 |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | ✅ | 클라이언트용 키 (RLS 적용) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 서버 전용 (RLS 우회, **절대 노출 금지**) |
| `SUPABASE_JWT_SECRET` | ✅ | HS256 JWT 검증용 |
| `FASTAPI_ENV` | ✅ | development / production |
| `FASTAPI_SECRET_KEY` | ✅ | FastAPI 내부 세션 키 |
| `ALLOWED_ORIGINS` | ✅ | CORS (콤마 구분) |
| `ENCRYPTION_KEY` | ✅ | KIS 자격증명 AES-256 키 |
| `OPENAI_API_KEY` | ✅ | 임베딩 + LLM |
| `DART_API_KEY` | ⚠️ 권장 | 재무제표 수집 (없으면 daily_update의 STEP 2 스킵) |
| `LANGCHAIN_TRACING_V2` | ❌ 선택 | LangSmith 모니터링 |
| `LANGCHAIN_API_KEY` | ❌ 선택 | LangSmith API 키 |

### Frontend `.env.local`

| 키 | 필수 | 용도 |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase URL (Backend와 동일) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | anon key (Backend와 동일) |
| `VITE_API_BASE_URL` | ✅ | 백엔드 URL (로컬: http://localhost:8000) |

---

## 9. 로컬 실행

### 9.1 백엔드
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                  # Windows
# source .venv/bin/activate              # macOS/Linux
pip install -r requirements.txt
cp .env.example .env                     # 실제 값 입력
PYTHONPATH=. ../.venv/Scripts/uvicorn main:app --reload --port 8000
```

### 9.2 프론트엔드
```bash
cd frontend
npm install
cp .env.example .env.local               # 실제 값 입력
npm run dev                              # http://localhost:5173
```

### 9.3 테스트
```bash
cd backend
PYTHONPATH=. ../.venv/Scripts/pytest tests/ -v
```

---

## 10. 배포

### 10.1 Backend (Render.com)
- `backend/Procfile`, `backend/render.yaml` 사용
- 환경변수: Render Dashboard → Environment 에 `.env` 항목 모두 등록
- **GitHub Actions 워크플로우** (`.github/workflows/`):
  - **`keep_alive.yml`** ("Keep Render Backend Alive") — 12분마다 `/health` 핑 (cron `*/12 * * * *`). Render Free tier 15분 idle sleep 전 깨우기. UptimeRobot 대체.
  - **`daily_update.yml`** ("Daily Stock Data Update") — 평일 18:30 KST (cron `30 9 * * 1-5`) `analysis/daily_update.py` 4 STEP + `data_quality_check.py` 자동 실행
- 상세: [backend/DEPLOY_RENDER.md](backend/DEPLOY_RENDER.md), [backend/RENDER_ENV_CHECKLIST.md](backend/RENDER_ENV_CHECKLIST.md)

### 10.2 Frontend (Vercel)
- `frontend/vercel.json` 사용
- 환경변수: Vercel Dashboard → Settings → Environment Variables
- 상세: [frontend/VERCEL_ENV_CHECKLIST.md](frontend/VERCEL_ENV_CHECKLIST.md)

### 10.3 KIS 실거래 전환
- 모의 → 실거래 시 별도 가이드 필수
- 상세: [backend/REAL_TRADING_GUIDE.md](backend/REAL_TRADING_GUIDE.md)

---

## 11. 🔐 보안 체크리스트

배포 전 / 발표 전 반드시 점검:

### 11.1 키 노출 방지

| 항목 | 상태 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` 가 frontend에 노출되지 않는가? | ✅ Backend `.env` 전용, `VITE_` prefix 안 붙음 |
| `ENCRYPTION_KEY` 가 git에 커밋되어 있지 않은가? | ✅ `.gitignore`에 `.env` 포함 |
| `DART_API_KEY`, `OPENAI_API_KEY` 가 git에 커밋되어 있지 않은가? | ✅ Backend `.env` 전용 |
| KIS API 키가 평문으로 DB 저장되지 않는가? | ✅ `encryption.py` 의 Fernet 암호화 후 저장 |
| 모든 KIS 키 응답에 마스킹 적용? | ✅ `credentials.py` 의 `_mask_key()` 사용 |

### 11.2 인증·인가

| 항목 | 상태 |
|---|---|
| 모든 보호된 엔드포인트에 `Depends(get_current_user)` 적용? | ✅ 모든 `/api/v1/*` |
| JWT 검증이 SSOT (`security.py`) 만 통과? | ✅ 직접 `jwt.decode` 호출 없음 |
| JWT 만료(`exp`) 확인? | ✅ `verify_jwt()` 내부 |
| 다른 프로젝트 JWT 거부? | ✅ `iss` 확인 |
| RLS 정책: 사용자는 자기 데이터만 SELECT? | ✅ `user_orders`, `user_kis_credentials` 등 |
| service_role 키는 서버에서만 사용? | ✅ `supabase_admin` 만 INSERT/UPDATE |

### 11.3 거래·금융 안전

| 항목 | 상태 |
|---|---|
| 거래시간 외 주문 차단? | ✅ Backend `_is_market_open()` + Frontend OrderForm `isMarketOpenClient()` |
| 한국 공휴일 자동 인식? | ✅ `holidays` 패키지 KR 공휴일 + KRX 12/31 휴장 |
| KIS API 실패 시 가짜 체결 기록 금지? | ✅ `status="rejected"` 명시 응답, user_orders INSERT 안 함 |
| 옵티미스틱 잔고가 KIS 실제 데이터와 동기화? | ✅ `_sync_local_with_kis_fills()` 가 status를 "접수→체결" 업데이트 |
| 모의/실거래 환경 분리? | ✅ `is_mock` 컬럼 + URL/TR-ID 자동 분기 |

### 11.4 데이터 노출

| 항목 | 상태 |
|---|---|
| `/docs` (Swagger UI) 가 production에서 비활성화? | ⚠️ 현재 활성 — 운영 시 비활성 고려 |
| 에러 메시지에 스택트레이스 노출 안 함? | ✅ HTTPException(detail=...) 으로 짧은 메시지만 |
| AI 답변에 PII (개인정보) 포함 검사? | ⚠️ 현재 미적용 — 향후 추가 검토 |
| 로그에 평문 API 키 출력 안 함? | ✅ 코드 검토 시 누락 없음 |

### 11.5 클라이언트 보안

| 항목 | 상태 |
|---|---|
| Vercel 배포 시 `VITE_SUPABASE_ANON_KEY` 만 사용 (RLS로 보호)? | ✅ |
| localStorage에 민감정보 저장 안 함? | ✅ 토큰은 Supabase SDK가 관리 |
| CORS 허용 origin 제한? | ✅ `ALLOWED_ORIGINS` 환경변수로 명시 |

---

## 12. 알려진 한계와 향후 계획

### 12.1 알려진 한계
- **KIS 모의계좌 환원 불가**: 매수가 KIS 서버에 반영되면 사용자가 직접 환원할 수 없음. KIS 모의투자 사이트의 "계좌 초기화" 기능으로만 가능
- **FSS 데이터 도메인 한계**: FSS 자료는 신용카드/임차/노후 중심으로 주식 도메인 용어 추출에 제한 → 카테고리 타깃 LLM 큐레이션 방식으로 보강
- **Free tier Cold Start**: Render 무료 플랜은 15분 idle 시 슬립 → 첫 요청 30초 지연. GitHub Actions `keep_alive.yml` 워크플로우가 12분마다 `/health` 핑으로 완화 중
- **DART OpenAPI 호출 제한**: 분기당 5만 호출 → 대량 종목 수집 시 페이싱 필요
- **Supabase Auth ES256/HS256 혼용**: JWT 검증 로직 복잡 → `security.py` 에서 자동 분기 처리됨

### 12.2 향후 계획
- 실시간 시세 WebSocket (현재 5초 폴링)
- 종목 추천 모델 (안전성 스코어 기반)
- 다국어 (영문 UI)

---

## 부록: 폴더 구조 요약

```
safeInvest/
├── PROJECT_FINAL.md                ← 이 파일
├── README.md                       ← 루트 간단 소개
│
├── backend/                        ← FastAPI 서버
│   ├── BACKEND_FINAL.md            ← 백엔드 상세 문서
│   ├── main.py                     ★ 진입점
│   ├── app/
│   │   ├── core/                   ★ security, encryption, config
│   │   ├── routers/                ★ 11개 라우터
│   │   ├── services/               ★ kis_client, rag_chain, chatbot_graph
│   │   ├── education/              교육 모듈 (서브앱)
│   │   ├── models/                 Pydantic 스키마
│   │   └── dependencies.py
│   ├── analysis/                   ★ daily_update, data_quality_check
│   ├── schema/                     ★ 5개 SQL 모듈 + README
│   ├── scripts/                    시드·운영 스크립트
│   ├── tests/                      pytest
│   ├── static/videos/              교육 영상 21편
│   ├── DEPLOY_RENDER.md
│   ├── RENDER_ENV_CHECKLIST.md
│   └── REAL_TRADING_GUIDE.md
│
└── frontend/                       ← React 앱
    ├── FRONTEND_FINAL.md           ← 프론트엔드 상세 문서
    ├── src/
    │   ├── pages/                  ★ TradePage, MarketAnalysisPage, ...
    │   ├── components/
    │   │   ├── trading/            매매 위젯 9개
    │   │   ├── analysis/           분석 위젯
    │   │   ├── education/          ★ StockDictionary, BeginnerGuide
    │   │   ├── ai/                 ChatWidget
    │   │   ├── layout/             Navbar
    │   │   ├── market/             시장 위젯
    │   │   └── common/             공통
    │   ├── pages/, hooks/, services/, utils/
    │   └── main.jsx, App.jsx
    └── VERCEL_ENV_CHECKLIST.md
```

---

*SafeInvest AI v1.0.0 — 1차 마감 완료 (2026-05-14)*
