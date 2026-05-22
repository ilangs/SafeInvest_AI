# SafeInvest AI — 아키텍처 설명

## 1. 컴포넌트별 역할

### Frontend (React 19 + Vite · Vercel)
| 컴포넌트 | 역할 |
|---|---|
| `LoginPage.jsx` | Supabase Auth 로그인 · 회원가입 화면 |
| `TradePage.jsx` | 매매 대시보드 — 시세·차트·호가·주문·잔고 위젯 통합 |
| `MyPage.jsx` | KIS 계좌 연결(모의투자 전용) · 학습 기록 관리 |
| `OrderForm.jsx` | 주문창 — 수량·가격 입력, 거래시간 클라이언트 검사 |
| `Orderbook.jsx` | 10단계 호가창, 가격 클릭 시 주문창 자동 입력 |
| `CandleChart.jsx` | 캔들 차트 + MA5/20/60, period(D/W/M) 전환 |
| `ChatWidget.jsx` | AI 챗봇 UI — 질문 입력·답변·출처 표시 |
| `services/api.js` | axios 래퍼 — JWT 자동 주입 · 401 처리 |
| `hooks/usePolling.js` | 5초 간격 시세 폴링 훅 |

### Backend (FastAPI + Uvicorn · Render)
| 컴포넌트 | 역할 |
|---|---|
| `main.py` | FastAPI 앱 진입점 — 라우터 등록·CORS·정적파일·헬스체크 |
| `core/security.py` | JWT 검증 SSOT — Supabase ES256/HS256 자동 분기 |
| `core/encryption.py` | KIS 자격증명 AES-256(Fernet) 암복호화 |
| `core/config.py` | pydantic-settings 환경변수 싱글턴 |
| `routers/credentials.py` | KIS 키 등록·검증·삭제 (모의투자 전용) |
| `routers/market.py` | 시세·차트·호가·검색 엔드포인트 |
| `routers/order.py` | 주문 실행 — 거래시간·실거래 차단 내장 |
| `routers/ai.py` | AI 챗봇 엔드포인트 |
| `services/kis_client.py` | KIS REST API 통합 — 시세·주문·잔고·동기화 |
| `services/rag_chain.py` | LangChain LCEL RAG 단일 질의 체인 |
| `services/chatbot_graph.py` | LangGraph 멀티스텝 챗봇 (retrieve→route→generate→save) |
| `analysis/daily_update.py` | 일일 KRX/DART/KIS 데이터 수집 파이프라인 |

### 외부 서비스
| 서비스 | 역할 |
|---|---|
| Supabase | PostgreSQL + pgvector + Auth(JWT) + RLS |
| KIS API | 한국투자증권 REST — 시세·차트·주문·잔고 |
| OpenAI API | text-embedding-3-small 임베딩 · GPT-4o 답변 생성 |

---

## 2. 데이터베이스 테이블 (12개)

| # | 테이블 | 용도 |
|---|---|---|
| 1 | `auth.users` | Supabase 인증 사용자 (id, email) |
| 2 | `user_kis_credentials` | 사용자별 KIS API 키 (AES-256 암호화) |
| 3 | `user_orders` | 매매 주문 로그 (status: 접수→체결) |
| 4 | `stocks` | 종목 마스터 (ticker, 이름, 시장, 섹터) |
| 5 | `stock_prices` | 일별 OHLCV 시계열 |
| 6 | `stock_financials` | 분기 재무제표 (순이익, 총자산 등) |
| 7 | `stock_warnings` | 위험 신호 (자본잠식·연속적자 등) |
| 8 | `stock_terms` | 주식·투자 용어 사전 (230개) |
| 9 | `knowledge_chunks` | RAG 문서 청크 |
| 10 | `knowledge_embeddings` | pgvector 임베딩 (1536-dim) |
| 11 | `chat_history` | 챗봇 대화 기록 (role, content, source_docs) |
| 12 | `watchlist` | 사용자 관심종목 |

---

## 3. 주요 엔드포인트 (15개)

| # | Method | Path | 설명 |
|---|---|---|---|
| 1 | GET | `/health` | 서버 상태 (keep_alive 핑) |
| 2 | GET | `/api/v1/auth/verify` | JWT 유효성 검증 |
| 3 | GET | `/api/v1/market/quote` | 현재가 조회 |
| 4 | GET | `/api/v1/market/chart` | OHLCV 차트 (D/W/M) |
| 5 | GET | `/api/v1/market/orderbook` | 10단계 호가 |
| 6 | GET | `/api/v1/market/search` | 종목 자동완성 |
| 7 | GET | `/api/v1/market/info` | 시가총액·PER·52주 |
| 8 | POST | `/api/v1/order` | 매수/매도 주문 (거래시간·실거래 차단) |
| 9 | GET | `/api/v1/orders/history` | 기간 매매내역 |
| 10 | GET | `/api/v1/account/balance` | 예수금·평가금액·총손익 |
| 11 | GET | `/api/v1/account/holdings` | 보유종목 |
| 12 | POST | `/api/v1/credentials/connect` | KIS 키 등록·검증 (모의투자 전용) |
| 13 | GET | `/api/v1/credentials/status` | KIS 연결 상태 조회 |
| 14 | POST | `/api/v1/ai/chat` | LangGraph 기반 AI 챗봇 |
| 15 | GET | `/api/v1/stocks/{ticker}/score` | 종목 안전성 스코어 |

---

## 4. 환경 변수

### Backend `.env`
| 키 | 필수 | 용도 |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | ✅ | 클라이언트용 키 (RLS 적용) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 서버 전용 (RLS 우회, 노출 금지) |
| `SUPABASE_JWT_SECRET` | ✅ | HS256 JWT 검증용 |
| `FASTAPI_ENV` | ✅ | development / production |
| `FASTAPI_SECRET_KEY` | ✅ | FastAPI 내부 세션 키 |
| `ALLOWED_ORIGINS` | ✅ | CORS 허용 origin (콤마 구분) |
| `ENCRYPTION_KEY` | ✅ | KIS 자격증명 AES-256 키 |
| `OPENAI_API_KEY` | ✅ | 임베딩 + LLM |
| `DART_API_KEY` | ⚠️ 권장 | 재무제표 수집 (없으면 STEP 2 스킵) |
| `LANGCHAIN_TRACING_V2` | ❌ 선택 | LangSmith 모니터링 |
| `LANGCHAIN_API_KEY` | ❌ 선택 | LangSmith API 키 |

### Frontend `.env.local`
| 키 | 필수 | 용도 |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase URL (Backend와 동일) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | anon key (Backend와 동일) |
| `VITE_API_BASE_URL` | ✅ | 백엔드 URL (로컬: http://localhost:8000) |

---

*SafeInvest AI v1.0.0 — 현재 모의투자만 지원, 실거래는 차후 서비스 예정*
