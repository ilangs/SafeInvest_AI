# SafeInvest AI — 폴더별 구조 설명서

> 발표용 문서 · Notion 붙여넣기 전용
> 건전 투자 가이드 + 주식 모의/실거래 체험 플랫폼

---

## 📂 프로젝트 최상위 구조

```
safeInvest/
├── backend/      # FastAPI 기반 서버 (Python 3.12)
├── frontend/     # React 19 + Vite SPA
├── .github/      # GitHub Actions / 워크플로
├── .venv/        # Python 가상환경
└── README.md
```

| 폴더 | 역할 | 기술 스택 |
| --- | --- | --- |
| `backend/` | API 서버, RAG, KIS 연동, 데이터 수집 | FastAPI · LangChain · Supabase · pgvector |
| `frontend/` | 사용자 UI, 차트, AI 챗봇 위젯 | React 19 · Vite · react-router 7 · axios |

---

# 🟦 backend/

FastAPI 서버. 인증·주문·시세·AI·교육 모듈을 모두 포함합니다.

```
backend/
├── main.py                  # FastAPI 앱 엔트리, 라우터 등록
├── Procfile / render.yaml   # Render 배포 설정
├── requirements.txt
├── app/                     # 애플리케이션 코드
├── analysis/                # 데이터 수집/품질 검증 스크립트
├── schema/                  # DB 스키마 + 마이그레이션 SQL
├── scripts/                 # 시드/임베딩 적재 스크립트
├── static/                  # 교육 영상(mp4)
└── tests/                   # pytest
```

## 📁 backend/app/

서버의 핵심 코드. 도메인 단위로 분리되어 있습니다.

```
app/
├── core/         # 공통 인프라(설정, 인증, 암호화, Supabase 클라이언트)
├── routers/      # HTTP 엔드포인트 (도메인별 분리)
├── services/     # 비즈니스 로직 (KIS, RAG, 챗봇 그래프)
├── models/       # Pydantic 스키마
├── education/    # 주식 교육 모듈 (별도 도메인)
└── dependencies.py  # FastAPI 의존성 주입 (JWT 사용자 추출 등)
```

### 📁 backend/app/core/

| 파일 | 설명 |
| --- | --- |
| `config.py` | `.env` 환경변수 로딩 (Pydantic Settings). `KIS_ACCOUNT`, `KIS_MOCK` 등 키 매핑 |
| `supabase.py` | Supabase 클라이언트 2종 (`supabase`: 사용자 키 / `supabase_admin`: 서비스 키) |
| `security.py` | JWT 토큰 검증, `TokenData` 모델 |
| `encryption.py` | KIS API Key 등 민감정보 암호화/복호화 |

### 📁 backend/app/routers/

도메인별 HTTP 라우터. `main.py`에서 모두 등록됩니다.

| 라우터 | Prefix | 역할 |
| --- | --- | --- |
| `auth.py` | `/api/v1/auth` | Supabase Auth 기반 회원가입/로그인 |
| `account.py` | `/api/v1/account` | KIS 계좌 잔고/예수금 조회 |
| `credentials.py` | `/api/v1/credentials` | KIS API Key/계좌번호 암호화 저장 |
| `market.py` | `/api/v1/market` | 시세, 호가, 캔들 조회 (KIS 프록시) |
| `stocks.py` | `/api/v1/stocks` | 종목 검색, 최근 검색어 |
| `watchlist.py` | `/api/v1/watchlist` | 관심 종목 CRUD |
| `order.py` / `orders.py` | `/api/v1/order(s)` | 주문 접수, 주문 내역 |
| `ai.py` | `/api/v1/ai` | AI 챗봇 (RAG → LangGraph 기반) |
| `study_logs.py` | `/api/v1/study-logs` | 학습 이력 저장/조회 |

### 📁 backend/app/services/

라우터에서 호출하는 외부 연동·비즈니스 로직.

| 파일 | 설명 |
| --- | --- |
| `kis_client.py` | 한국투자증권 OpenAPI 래퍼 (시세/호가/잔고/주문 실 TR) |
| `rag_chain.py` | Supabase pgvector RPC 직접 호출 + 세이프 페르소나 프롬프트 |
| `chatbot_graph.py` | **LangGraph** 기반 다단계 챗봇 워크플로 (분기/툴 호출) |
| `CHATBOT_GRAPH.md` | 챗봇 그래프 설계 문서 |

### 📁 backend/app/models/

- `schemas.py` — Pydantic 요청/응답 스키마 일괄 정의 (`ChatRequest`, `OrderRequest`, `HoldingItem`, `AccountBalanceResponse` 등).

### 📁 backend/app/education/

주식 교육 모듈. 라우터·매처·데이터가 한 폴더에 모여 있는 독립 도메인입니다.

| 파일/폴더 | 설명 |
| --- | --- |
| `router.py` | `/api/v1/education` 엔드포인트 |
| `curriculum.py` / `curriculum_matcher.py` | 사용자 수준에 맞는 학습 경로 추천 |
| `matcher.py` | 키워드 → 학습 토픽 매칭 |
| `llm.py` | 교육용 LLM 프롬프트 |
| `fss_proxy.py` | 금융감독원(FSS) 데이터 프록시 |
| `data/` | `learning_paths.py`, `topic_pools.py`, `self_contents.py`, `real_contents.json`, `mock_data.py` |

## 📁 backend/analysis/

일별 데이터 수집·품질 점검 배치.

| 파일 | 설명 |
| --- | --- |
| `daily_update.py` | 일별 시세/재무 데이터 적재 |
| `data_quality_check.py` | 2-Tier 품질 검증 (결측/이상치) |
| `DAILY_UPDATE_README.md` | 운영 가이드 |

## 📁 backend/schema/

Supabase Postgres DDL. **번호 순서대로 적용**합니다.

- `init.sql` — 초기 스키마 (v2.0)
- `init_kis_credentials.sql` / `init_analysis_tables.sql` / `init_stock_terms.sql`
- `migration_01 ~ 09_*.sql` — 증분 마이그레이션 (계좌번호 암호화, 최근 검색어, 주문, 품질 함수, FSS RAG 등)

## 📁 backend/scripts/

운영/시드 스크립트.

| 파일 | 설명 |
| --- | --- |
| `seed_knowledge.py` | RAG 지식 청크 + pgvector 임베딩 적재 |
| `seed_fss_contents.py` | FSS 교육 콘텐츠 시드 |
| `seed_stock_data.py` | 종목 마스터 데이터 |
| `export_stock_terms.py` / `extract_terms_by_category.py` / `upsert_new_terms.py` | 용어집 관리 |
| `TECH_pgvector_rag.md` | pgvector RAG 기술 노트 |

## 📁 backend/static/videos/

자체 제작 교육 영상(mp4). `self_A01_PER`, `self_B01_income_statement`, `self_F03_chart_basics` 등 카테고리 코드 체계로 관리.

## 📁 backend/tests/

- `test_health.py`, `test_scenarios.py` — pytest 시나리오 테스트.

---

# 🟩 frontend/

React 19 + Vite 기반 SPA.

```
frontend/
├── index.html
├── vite.config.js
├── vercel.json                 # Vercel 배포 설정
├── public/                     # 정적 자산
├── dev-dist/                   # PWA 서비스워커 빌드 산출물
└── src/
    ├── main.jsx / App.jsx      # 엔트리 + 라우팅
    ├── pages/                  # 라우트별 페이지
    ├── components/             # 도메인별 컴포넌트
    ├── hooks/                  # 커스텀 훅
    ├── services/               # API/Supabase 클라이언트
    └── utils/                  # 포맷터
```

## 📁 frontend/src/pages/

라우트 1:1로 매핑되는 페이지 컴포넌트.

| 페이지 | 역할 |
| --- | --- |
| `HomePage.jsx` | 랜딩 |
| `LoginPage.jsx` | Supabase Auth 로그인 |
| `DashboardPage.jsx` | 메인 대시보드 (잔고/관심종목/시세) |
| `TradePage.jsx` | 매매 화면 (차트 + 호가 + 주문) |
| `MarketAnalysisPage.jsx` | 시장 분석 (탭 구조) |
| `EducationPage.jsx` | 교육 콘텐츠 허브 |
| `ContentViewerPage.jsx` | 영상/아티클 뷰어 |
| `StudyLogPage.jsx` | 학습 이력 |
| `AiChatPage.jsx` | AI 상담 전용 페이지 |
| `MyPage.jsx` | 마이페이지 (KIS Key 등록) |
| `FaqPage.jsx` / `NoticePage.jsx` | FAQ · 공지 |

## 📁 frontend/src/components/

도메인별로 분리. 페이지가 컴포넌트를 조립합니다.

### components/layout/
- `Navbar.jsx` — 전역 네비게이션.

### components/common/
- `Logo.jsx`, `ScrollToTop.jsx` — 공통 위젯.

### components/ai/
- `ChatWidget.jsx` — 플로팅 AI 챗 위젯 (전 페이지에서 사용)
- `LinkButton.jsx` — RAG 답변 내 소스 링크 버튼

### components/market/
- `QuoteWidget.jsx` — 5초 폴링 시세
- `WatchlistWidget.jsx` — 관심종목 리스트

### components/trading/
매매 화면 구성요소.

| 컴포넌트 | 설명 |
| --- | --- |
| `CandleChart.jsx` / `ChartWidget.jsx` | 캔들 차트 |
| `Orderbook.jsx` / `OrderbookWidget.jsx` | 실시간 호가 |
| `OrderForm.jsx` | 매수/매도 주문 폼 |
| `BalanceWidget.jsx` | 예수금/평가금액 |
| `HoldingsWidget.jsx` | 보유 종목 |
| `TodayOrdersWidget.jsx` | 당일 주문 내역 |
| `StockInfoWidget.jsx` | 종목 기본정보 |

### components/education/
- `BeginnerGuide.jsx` (+ css) — 초보자 가이드
- `StockDictionary.jsx` — 주식 백과사전

### components/analysis/
- `AnalysisHome.jsx`, `AnalysisDetail.jsx` + `tabs/`, `shared/` — 시장 분석 탭/공통 요소.

## 📁 frontend/src/hooks/

| 훅 | 역할 |
| --- | --- |
| `useAuth.js` | Supabase 세션·JWT 관리 |
| `usePolling.js` | 시세 등 주기적 폴링 |
| `useStockName.js` | 종목코드 → 종목명 캐시 |

## 📁 frontend/src/services/

| 파일 | 설명 |
| --- | --- |
| `api.js` | axios 인스턴스 + JWT 자동 주입 + 401 처리 |
| `supabase.js` | supabase-js 클라이언트 |
| `analysisApi.js` | 시장 분석 전용 API 호출 |

## 📁 frontend/src/utils/
- `format.js` — 숫자/통화/등락률 포맷터.

---

# 🔗 폴더 간 데이터 흐름 (요약)

1. **사용자 요청** → `frontend/src/pages` → `services/api.js` (axios + JWT)
2. → **FastAPI** `backend/app/routers/*`
3. → **비즈니스 로직** `backend/app/services/*` (KIS, RAG, LangGraph)
4. → **데이터** Supabase Postgres / pgvector / KIS OpenAPI
5. ← 응답은 역순으로 React 컴포넌트까지 전달

> AI 챗봇은 `ai.py` → `chatbot_graph.py` (LangGraph) → 필요 시 `rag_chain.py`(pgvector RPC) 경로로 동작.

---

# 🗂 발표 시 추천 진행 순서

1. **최상위 `backend / frontend`** — 2-tier 구조 소개
2. **`backend/app/routers`** — 도메인별 API 라인업 한눈에
3. **`backend/app/services`** — KIS 실거래 + RAG/LangGraph 핵심 가치
4. **`backend/schema` & `analysis`** — 데이터 파이프라인 & 품질 검증
5. **`frontend/src/pages` → `components/trading`** — UI 시연 흐름
6. **`components/ai` + `services/api.js`** — 챗봇이 전 페이지에서 동작하는 구조 강조
