# SafeInvest AI — Backend (최종본)

> **버전** : 1.0.0 (전체 Phase 완료)
> **배포** : Render.com
> **Python** : 3.12 | **FastAPI** : 0.136 | **LangChain** : 0.3.25 | **LangGraph** : 0.6
> **최종 갱신** : 2026-05-14

---

## 1. 프로젝트 구조 (실제 적용 상태)

```
backend/
├── main.py                              # FastAPI 앱 진입점, 라우터 등록, CORS, 정적파일
│
├── app/
│   ├── core/
│   │   ├── config.py                    # pydantic-settings 환경변수 (settings 싱글턴)
│   │   ├── supabase.py                  # Supabase 클라이언트 (anon / admin)
│   │   ├── security.py                  # JWT 검증 SSOT
│   │   └── encryption.py                # KIS 자격증명 AES-256 (Fernet)
│   │
│   ├── routers/                         # FastAPI 엔드포인트
│   │   ├── auth.py                      # /api/v1/auth/*
│   │   ├── market.py                    # /api/v1/market/*  (시세·차트·검색)
│   │   ├── order.py                     # /api/v1/order      (주문 — 거래시간 차단 내장)
│   │   ├── orders.py                    # /api/v1/orders/*   (매매내역·당일주문)
│   │   ├── ai.py                        # /api/v1/ai/chat    (LangGraph 챗봇)
│   │   ├── watchlist.py                 # /api/v1/watchlist/*
│   │   ├── account.py                   # /api/v1/account/*  (잔고·보유종목)
│   │   ├── stocks.py                    # /api/v1/stocks/*   (시장분석)
│   │   ├── credentials.py               # /api/v1/credentials/* (KIS 자격증명 관리)
│   │   └── study_logs.py                # /api/v1/study-logs/*
│   │
│   ├── services/
│   │   ├── kis_client.py                # KIS REST API 통합 (모의/실전, 거래시간 체크, 옵티미스틱 보유종목)
│   │   ├── rag_chain.py                 # LangChain LCEL RAG 체인
│   │   ├── chatbot_graph.py             # LangGraph 멀티스텝 챗봇 (라우팅·도구·답변)
│   │   └── CHATBOT_GRAPH.md             # 챗봇 그래프 설계 문서
│   │
│   ├── education/                       # 교육 모듈 (별도 서브앱)
│   │   ├── router.py                    # 교육 콘텐츠 API
│   │   ├── curriculum.py                # 단계별 커리큘럼
│   │   ├── curriculum_matcher.py        # 사용자 수준 매칭
│   │   ├── matcher.py                   # 콘텐츠 추천 매칭
│   │   ├── fss_proxy.py                 # FSS 금융교육 콘텐츠 프록시
│   │   ├── llm.py                       # 교육용 LLM 호출
│   │   └── data/                        # 정적 콘텐츠 (mock_data, learning_paths, real_contents)
│   │
│   ├── models/
│   │   └── schemas.py                   # Pydantic v2 요청/응답 스키마
│   │
│   └── dependencies.py                  # get_current_user (JWT Depends 주입)
│
├── analysis/                            # 시장분석 데이터 파이프라인
│   ├── daily_update.py                  # 일일 KRX 데이터 수집
│   ├── data_quality_check.py            # 2-Tier 품질검증
│   └── DAILY_UPDATE_README.md
│
├── schema/                              # Supabase DB 스키마 (5개 모듈 + README)
│   ├── 01_foundation.sql                # 확장·공통트리거·사용자 기본 테이블
│   ├── 02_kis_credentials.sql           # 🔐 KIS 자격증명 (AES-256)
│   ├── 03_trading.sql                   # 매매 (user_orders)
│   ├── 04_market_analysis.sql           # 시장분석 + 품질검증
│   ├── 05_ai_education.sql              # 챗봇·교육·백과사전
│   └── README.md                        # 실행 순서·검증 쿼리·문제 해결
│
├── scripts/                             # 시드·운영 스크립트
│   ├── seed_stock_data.py               # 기본 종목 데이터 시드
│   ├── seed_knowledge.py                # RAG 지식 시드
│   ├── seed_fss_contents.py             # FSS 콘텐츠 시드
│   ├── extract_terms_by_category.py     # (1회성) 주식용어 LLM 생성
│   ├── upsert_new_terms.py              # (1회성) 신규 용어 DB 반영
│   ├── export_stock_terms.py            # 주식용어 DB → JSON 백업
│   ├── stock_terms.json                 # 마스터 백업 (230개 용어)
│   └── TECH_pgvector_rag.md             # pgvector RAG 기술 노트
│
├── tests/
│   ├── test_health.py                   # 헬스체크·인증 단위 테스트
│   └── test_scenarios.py                # 전체 시나리오 통합 테스트
│
├── static/videos/                       # 교육 영상 mp4 (21개)
│
├── requirements.txt                     # 의존성 (버전 고정)
├── Procfile, render.yaml                # Render.com 배포 설정
├── DEPLOY_RENDER.md                     # Render 배포 가이드
├── RENDER_ENV_CHECKLIST.md              # 환경변수 체크리스트
├── REAL_TRADING_GUIDE.md                # 실전 거래 전환 가이드
└── BACKEND_FINAL.md                     # ⭐ 이 파일
```

---

## 2. 엔드포인트 목록 (실제 적용)

### 인증·시스템
| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/health` | ❌ | 서버 상태 (GitHub Actions `keep_alive.yml` 이 12분마다 호출) |
| GET | `/docs` | ❌ | Swagger UI |
| GET | `/api/v1/auth/verify` | ✅ | JWT 유효성 검증 |

### 시세·시장
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/v1/market/quote` | 현재가 (KIS) |
| GET | `/api/v1/market/orderbook` | 호가 |
| GET | `/api/v1/market/chart` | OHLCV 차트 |
| GET | `/api/v1/market/search` | 종목 자동완성 |
| GET | `/api/v1/market/info` | 시가총액·PER·52주 |
| GET | `/api/v1/market/stats` | 시장 전체 통계 |

### 주문·매매
| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/order` | 매수/매도 주문 (거래시간 외 차단) |
| GET | `/api/v1/orders/today` | 당일 주문내역 |
| GET | `/api/v1/orders/history` | 기간 매매내역 |

### 계좌
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/v1/account/balance` | 예수금·평가금액·총손익 |
| GET | `/api/v1/account/holdings` | 보유종목 |
| GET/POST/DELETE | `/api/v1/credentials/*` | KIS 자격증명 관리 (AES-256 암호화) |

### 종목 분석
| Method | Path | 설명 |
|---|---|---|
| GET | `/api/v1/stocks` | 전체 종목 |
| GET | `/api/v1/stocks/{ticker}` | 기본정보 (market/sector/industry) |
| GET | `/api/v1/stocks/{ticker}/score` | 안전성 스코어 |
| GET | `/api/v1/stocks/{ticker}/financials` | 재무 |
| GET | `/api/v1/stocks/{ticker}/prices` | 가격 시계열 |
| GET | `/api/v1/stocks/{ticker}/warnings` | 경고 신호 |
| POST | `/api/v1/stocks/{ticker}/ai` | AI 분석 |
| GET/POST/DELETE | `/api/v1/recent-searches/*` | 최근 조회 |

### 관심종목·학습·교육
| Method | Path | 설명 |
|---|---|---|
| GET/POST/DELETE | `/api/v1/watchlist/*` | 관심종목 CRUD |
| GET/POST | `/api/v1/study-logs/*` | 학습 기록 |
| GET | `/api/v1/education/*` | 교육 콘텐츠 |
| GET | `/api/v1/curriculum/*` | 커리큘럼 |
| GET | `/api/v1/self-contents` | FSS 콘텐츠 프록시 |

### AI 챗봇
| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/ai/chat` | LangGraph 기반 멀티스텝 챗봇 |

---

## 3. 핵심 설계 원칙

| 항목 | 원칙 |
|---|---|
| **환경변수** | `os.environ` 직접 읽기 금지 → `from app.core.config import settings` |
| **JWT 검증** | `app/core/security.py` 의 `verify_jwt()` 만 사용 |
| **LangChain** | LCEL 방식만 허용. LangGraph는 멀티스텝 챗봇에 사용 |
| **Supabase 쓰기** | `supabase_admin` (service_role) 만 INSERT/UPDATE/DELETE |
| **RAG 검색** | `supabase_admin.rpc('match_knowledge')` 직접 호출 |
| **KIS 자격증명** | `user_kis_credentials` 테이블에 AES-256 (Fernet) 암호화 저장 |
| **거래시간 차단** | `kis_client._is_market_open()` — 주말·공휴일·정규장 외 주문 거부 |
| **잔고 동기화** | `_record_local_order(status='접수')` → KIS 체결 확인 후 `_sync_local_with_kis_fills()` |

---

## 4. 빠른 시작 (로컬)

### 4.1 환경변수
```bash
cp .env.example .env
# .env에 실제 값 입력
```

### 4.2 의존성 설치
```bash
python -m venv .venv
.venv\Scripts\activate     # Windows
# source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
```

### 4.3 DB 초기화 (Supabase SQL Editor)
1. `schema/01_foundation.sql` → `02_kis_credentials.sql` → `03_trading.sql`
   → `04_market_analysis.sql` → `05_ai_education.sql` 순서대로 실행
   (상세: `schema/README.md`)
2. `python scripts/seed_stock_data.py` — 종목 마스터 데이터
3. `python scripts/seed_knowledge.py` — RAG 지식 시드
4. (선택) `python scripts/seed_fss_contents.py` — FSS 교육 콘텐츠
5. `python scripts/upsert_new_terms.py --apply` — 주식 백과사전 230개

### 4.4 서버 실행
```bash
cd backend
PYTHONPATH=. ../.venv/Scripts/uvicorn main:app --reload --port 8000
```

### 4.5 테스트
```bash
PYTHONPATH=. ../.venv/Scripts/pytest tests/ -v
```

---

## 5. 기술 스택

| 항목 | 사용 기술 |
|---|---|
| 웹 프레임워크 | FastAPI 0.136 + Uvicorn |
| 스키마 검증 | Pydantic v2 + pydantic-settings |
| DB / Auth / RPC | Supabase (PostgreSQL + pgvector + RLS) |
| AI / RAG | LangChain 0.3.25 LCEL + LangGraph 0.6 |
| 임베딩 | OpenAI `text-embedding-3-small` (1536-dim) |
| LLM | OpenAI `gpt-4o-mini` (대화), `gpt-4o` (1회성 큐레이션) |
| 주식 API | KIS (한국투자증권) REST API |
| 데이터 소스 | KRX, DART OpenAPI |
| 암호화 | cryptography Fernet (AES-256) |
| 인증 | Supabase JWT (PyJWT 검증) |
| 백그라운드 작업 | GitHub Actions (`keep_alive.yml` 12분 ping, `daily_update.yml` 평일 18:30 KST) |

---

## 6. 배포

- **Render.com** (Free tier): `Procfile` + `render.yaml`
- **GitHub Actions 워크플로우** (`.github/workflows/`):
  - **`keep_alive.yml`** ("Keep Render Backend Alive") — 12분마다 `/health` 핑 (cron `*/12 * * * *`). Render Free tier 15분 idle sleep 전 깨우기. UptimeRobot 대체
  - **`daily_update.yml`** ("Daily Stock Data Update") — 평일 18:30 KST (cron `30 9 * * 1-5`) `analysis/daily_update.py` 4 STEP + `data_quality_check.py` 자동 실행
- 상세: [DEPLOY_RENDER.md](./DEPLOY_RENDER.md) 및 [RENDER_ENV_CHECKLIST.md](./RENDER_ENV_CHECKLIST.md)

---

## 7. 알려진 한계

- **KIS 모의계좌 환원**: 매수가 KIS 서버에 반영되면 사용자가 직접 환원 불가. KIS 모의투자 사이트의 "계좌 초기화"만 가능
- **FSS 데이터 도메인**: 저축/신용카드/임차 중심이라 주식 도메인 용어 마이닝엔 한계 (현재 카테고리 큐레이션 방식으로 보강)
- **Free tier Cold Start**: Render 무료 플랜은 15분 idle 시 슬립 → 첫 요청 30초 지연 가능. GitHub Actions `keep_alive.yml` 워크플로우가 12분마다 `/health` 핑으로 완화

---

*SafeInvest AI Backend — Final v1.0.0*
