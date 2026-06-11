# SafeInvest AI — DB 테이블 구조 설명서

> **DB**: Supabase Postgres + pgvector + RLS
> **총 테이블**: 24개 / **뷰**: 1개 / **RPC 함수**: 11개 / **트리거**: 9개
> **적용 순서**: `01 → 02 → 03 → 04 → 05 → 06` (Supabase Dashboard SQL Editor)

---

## 1. 모듈 구성 한눈에 보기

| # | 모듈 파일 | 핵심 테마 | 테이블 수 |
|---|---|---|---|
| 01 | `01_foundation.sql` | 사용자 기반 + 확장 설치 | 3 |
| 02 | `02_kis_credentials.sql` | KIS API 키 암호화 저장 | 1 |
| 03 | `03_trading.sql` | 매수/매도 주문 로그 | 1 |
| 04 | `04_market_analysis.sql` | 종목·재무·위험 데이터 + 품질검증 | 8 |
| 05 | `05_ai_education.sql` | RAG 챗봇 + 교육 콘텐츠 | 6 |
| 06 | `06_beta_safeguards.sql` | 베타 안전벨트 (한도·비용·아카이브) | 2 + ALTER |

---

## 2. 전체 ERD (관계도)

```
auth.users (Supabase Auth)
   │
   ├── user_profiles  ───┐ (1:1, ON DELETE CASCADE)
   ├── user_settings    │
   ├── watchlist        │
   ├── user_kis_credentials  (모의 1 + 실거래 1)
   ├── user_orders ─────── idempotency_key UNIQUE
   ├── chat_history ────── input/output_tokens, cost_usd
   │       └── chat_history_archive (30일+ 이관)
   ├── recent_searches
   └── study_logs

stocks (ticker)
   ├── stock_prices       (ticker, trade_date) PK
   ├── stock_financials   (ticker, year, quarter) PK
   └── stock_warnings

knowledge_chunks
   └── knowledge_embeddings (VECTOR(1536))
       ↑
   match_knowledge / match_knowledge_fss (RPC)

fss_contents ── (metadata.contents_slno) ── knowledge_chunks
stock_terms (230개 용어 백과)

daily_cost_log (Circuit Breaker)
data_collection_log / data_quality_reports / data_quality_items
```

---

## 3. 모듈별 테이블 상세

### 📦 [01] Foundation — 사용자 기반

#### `user_profiles` — 사용자 프로필
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | UUID | **PK**, FK→auth.users | Supabase Auth와 1:1 |
| `nickname` | TEXT | | 닉네임 |
| `risk_level` | TEXT | CHECK(conservative/moderate/aggressive) | 투자 성향 |
| `created_at` / `updated_at` | TIMESTAMPTZ | | |

🔹 **트리거**: `trg_on_auth_user_created` — 신규 가입 시 자동 생성 (SECURITY DEFINER)
🔒 **RLS**: `auth.uid() = id`

#### `user_settings` — 대시보드 위젯 레이아웃
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `layout_json` | JSONB | 위젯 배치 정보 |

🔒 **RLS**: `auth.uid() = user_id`

#### `watchlist` — 관심종목
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `stock_code` | TEXT | UNIQUE(user_id, stock_code) |
| `stock_name` | TEXT | 캐시 |

📑 **인덱스**: `idx_watchlist_user(user_id)`

---

### 🔐 [02] KIS Credentials — KIS 자격증명 (AES-256 암호화)

#### `user_kis_credentials`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `enc_app_key` | TEXT | **암호문** (Fernet AES-256) |
| `enc_app_secret` | TEXT | **암호문** |
| `enc_account_no` | TEXT | **암호문** |
| `account_no_masked` | TEXT | UI 표시용 (예: `5012****`) |
| `is_mock` | BOOLEAN | 모의/실거래 구분 |
| `access_token` | TEXT | KIS 24시간 토큰 캐시 |
| `token_expires_at` | TIMESTAMPTZ | 만료 시각 |
| `is_active` | BOOLEAN | |

🔑 **UNIQUE**: `(user_id, is_mock)` — 사용자당 모의 1 + 실거래 1
🔒 **RLS**: `auth.uid() = user_id`
⚠️ **복호화 키**: `ENCRYPTION_KEY` 환경변수 (DB 유출 시에도 안전)

---

### 💰 [03] Trading — 매매 로그

#### `user_orders` — 매매 주문 (옵티미스틱 잔고 패턴)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID | |
| `is_mock` | BOOLEAN | 모의/실거래 |
| `stock_code` / `stock_name` | TEXT | 종목코드/명 |
| `order_type` | TEXT | `buy` \| `sell` |
| `quantity` | INTEGER | |
| `price` | INTEGER | |
| `status` | TEXT | `접수` (즉시 INSERT) → `체결` (KIS 확인) |
| `order_id_ext` | TEXT | KIS 발급 주문ID (체결 매칭 키) |
| `order_date` / `order_time` | TEXT | KST `YYYYMMDD`/`HHMMSS` |
| `idempotency_key` ⭐ | TEXT | **[06 추가]** 중복 주문 차단 |

📑 **인덱스**: `idx_user_orders_lookup (user_id, is_mock, order_date DESC, order_time DESC)`
🔑 **UNIQUE 부분 인덱스**: `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`
🔒 **RLS**: `auth.uid() = user_id`

---

### 📊 [04] Market Analysis — 시장분석 데이터

#### `stocks` — 종목 마스터
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `ticker` | TEXT **PK** | 6자리 종목코드 |
| `stock_name` / `market` / `sector` / `industry` | TEXT | |
| `listing_date` | TEXT | YYYY-MM-DD |

#### `stock_prices` — 일별 OHLCV
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `ticker` | TEXT | **PK** |
| `trade_date` | TEXT | **PK** YYYY-MM-DD |
| `open/high/low/close_price` | BIGINT | |
| `volume` | BIGINT | |
| `amount` | TEXT | 거래대금 |

📑 **인덱스**: `idx_stock_prices_ticker`, `idx_stock_prices_date`

#### `stock_financials` — 분기·연간 재무제표
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `ticker` / `fiscal_year` / `fiscal_quarter` | TEXT | **복합 PK** (Q1~Q4, A=연간) |
| `revenue` | BIGINT | 매출액 |
| `operating_profit` | BIGINT | 영업이익 |
| `net_income` | BIGINT | 당기순이익 |
| `total_assets` / `total_equity` / `total_liabilities` | BIGINT | BS 핵심 |
| `debt_ratio` | REAL | 부채비율 (%) |
| `roe` | REAL | 자기자본이익률 (%) |
| `capital_impairment` | BOOLEAN | 자본잠식 여부 |
| `data_source` | TEXT | DART/KIS/manual |

#### `stock_warnings` — 위험 신호
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `ticker` | TEXT | |
| `warning_type` | TEXT | CAPITAL_IMPAIRMENT / CONTINUOUS_LOSS / HIGH_DEBT / LOW_REVENUE |
| `designated_date` / `release_date` | TEXT | 지정/해제일 |
| `is_active` | BOOLEAN | |

🔑 **UNIQUE**: `(ticker, warning_type)`

#### `stock_companies` / `risk_flags` *(레거시 — seed 스크립트 호환용)*

#### `recent_searches` — 최근 조회 종목
| `user_id` | `ticker` | UNIQUE(user_id, ticker) |

#### `data_collection_log` — 일일 수집 결과 로그

#### `data_quality_reports` / `data_quality_items` — 데이터 품질 보고서
- `analysis/data_quality_check.py` 가 일일 수집 후 자동 적재
- `overall_grade`: PASS / WARN / FAIL

🔒 **RLS**: 시장 데이터는 `auth.role() = 'authenticated'` → 인증된 사용자 누구나 SELECT, 쓰기는 `service_role` 만

---

### 🤖 [05] AI & Education — RAG 챗봇 + 교육

#### `chat_history` — AI 대화 기록
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `question` / `answer` | TEXT | |
| `session_id` | TEXT | |
| `input_tokens` ⭐ | INTEGER | **[06 추가]** LLM 입력 토큰 |
| `output_tokens` ⭐ | INTEGER | **[06 추가]** LLM 출력 토큰 |
| `cost_usd` ⭐ | NUMERIC(10,6) | **[06 추가]** 이 대화의 USD 비용 |

📑 **인덱스**: `idx_chat_user(user_id, created_at DESC)`
🔒 **RLS SELECT**: `auth.uid() = user_id`

#### `knowledge_chunks` — RAG 문서 청크
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `category` / `title` / `content` | TEXT | |
| `source` | TEXT | FSS / manual |
| `source_url` | TEXT | |
| `tags` | TEXT[] | |
| `metadata` | JSONB | `{contents_slno, category_code}` |

📑 **부분 인덱스**: FSS 슬로/카테고리 (`WHERE source='FSS'`)

#### `knowledge_embeddings` — pgvector 1536차 임베딩
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `chunk_id` | UUID FK→knowledge_chunks ON DELETE CASCADE | |
| `embedding` | VECTOR(1536) | OpenAI text-embedding-3-small |

📑 **ivfflat 인덱스**: `embedding vector_cosine_ops (lists=100)`

#### `fss_contents` — 금감원 콘텐츠 메타
| `contents_slno` PK · `category_code` · `title` · `raw_html` · `plain_text` · `chunk_count` · `embedded_at` ... |

🔹 **트리거**: `trg_fss_contents_updated_at` (moddatetime)

#### `stock_terms` — 주식 용어 백과사전 (230개)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | TEXT PK | T001 ~ T230 |
| `term` / `term_ko` | TEXT | 영문/한국어 정식명 |
| `category` | TEXT | 17개 카테고리 |
| `importance` | SMALLINT (1~5) | |
| `initial_ko` / `initial_en` | TEXT | 초성 ㄱㄴㄷ / A~Z |
| `tags` / `related_ids` | TEXT[] | |
| `description` / `easy_desc` / `formula` / `caution` | TEXT | |
| `view_count` | INTEGER | |

📑 **인덱스**: 초성, 카테고리, 중요도 + **GIN FTS** (term + term_ko + description)
🔒 **RLS**: SELECT 누구나(`true`), 쓰기는 인증된 사용자

#### `study_logs` — 학습 일기
| `user_id` · `title` · `content` · `tag` · `mood` · `ai_comment` · `log_date` |

📑 **인덱스**: `idx_study_logs_user_date(user_id, log_date DESC, created_at DESC)`
🔹 **트리거**: `trg_study_logs_updated_at` (moddatetime)

---

### 🛡️ [06] Beta Safeguards — 베타 안전벨트

#### `chat_history_archive` — 30일+ 대화 아카이브
- `chat_history` 와 동일 컬럼 + `archived_at`
- `backend/scripts/archive_old_chats.py` 가 매주 일요일 03:00 KST 이관
- 트리거 회피용 별도 테이블

#### `daily_cost_log` — 시스템 일일 비용 누적 (Circuit Breaker)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `log_date` | DATE **PK** | KST 자정 기준 일자 |
| `total_cost_usd` | NUMERIC(12,6) | 누적 비용 |
| `total_tokens` | BIGINT | 누적 토큰 |
| `call_count` | INTEGER | 누적 호출 수 |
| `updated_at` | TIMESTAMPTZ | |

🔒 **RLS**: 정책 미부여 → `service_role` 만 접근

---

## 4. RPC 함수 (총 11개)

| 함수 | 모듈 | 호출자 | 반환 |
|---|---|---|---|
| `handle_new_user()` | 01 | auth.users 트리거 | trigger |
| `update_updated_at()` | 01 | 다수 트리거 | trigger |
| `qc_check_duplicates()` | 04 | data_quality_check.py | (table_name, total, distinct, dup) |
| `qc_check_orphan_tickers()` | 04 | 동상 | (issue_type, orphan_count) |
| `qc_null_summary()` | 04 | 동상 | NULL 카운트 |
| `match_knowledge(emb, k, threshold, filter)` | 05 | rag_chain.py | 코사인 유사도 top-k |
| `match_knowledge_fss(emb, k, threshold, codes)` | 05 | chatbot_graph.py retrieve 노드 | FSS 전용 |
| `increment_view_count(term_id)` | 05 | StockDictionary.jsx | VOID |
| `usage_today_chat(user_id)` ⭐ | 06 | rate_limit.py | (used, limit, remaining, tokens_used, token_limit, token_remaining) |
| `usage_today_orders(user_id)` ⭐ | 06 | rate_limit.py | (used, limit, remaining) |
| `accrue_daily_cost(cost, tokens)` ⭐ | 06 | chatbot_graph.save_history | UPSERT |
| `system_cost_today()` ⭐ | 06 | rate_limit.check_breaker | (cost_used, limit, remaining, tokens, calls) |

---

## 5. 트리거 (총 9개)

| 트리거 | 테이블 | 시점 | 동작 |
|---|---|---|---|
| `trg_on_auth_user_created` | auth.users | AFTER INSERT | user_profiles 자동 생성 |
| `trg_user_profiles_updated_at` | user_profiles | BEFORE UPDATE | updated_at 갱신 |
| `trg_user_settings_updated_at` | user_settings | BEFORE UPDATE | updated_at 갱신 |
| `trg_kis_cred_updated` | user_kis_credentials | BEFORE UPDATE | updated_at 갱신 |
| `trg_fss_contents_updated_at` | fss_contents | BEFORE UPDATE | moddatetime |
| `trg_stock_terms_updated` | stock_terms | BEFORE UPDATE | updated_at 갱신 |
| `trg_study_logs_updated_at` | study_logs | BEFORE UPDATE | moddatetime |
| `trg_chat_history_rate_limit` ⭐ | chat_history | BEFORE INSERT | **50/일 + 5/분 초과 시 P0001 예외** |
| `trg_user_orders_rate_limit` ⭐ | user_orders | BEFORE INSERT | **모의 20/일 + 5/분 초과 시 P0001 예외** |

---

## 6. RLS 정책 요약

| 패턴 | 적용 테이블 | 정책 |
|---|---|---|
| 본인 데이터만 (`auth.uid() = user_id`) | user_profiles, user_settings, watchlist, user_kis_credentials, user_orders, recent_searches, study_logs, chat_history(SELECT), chat_history_archive(SELECT) | FOR ALL or FOR SELECT |
| 인증 사용자 SELECT | stocks, stock_prices, stock_financials, stock_warnings, knowledge_chunks, knowledge_embeddings, fss_contents, stock_companies, risk_flags | `auth.role() = 'authenticated'` |
| 공개 SELECT | stock_terms | `true` (누구나) |
| service_role 만 | daily_cost_log, data_quality_reports, data_quality_items | RLS ON + 정책 없음 |

---

## 7. 베타 운영 한도 (모듈 06)

| 항목 | 한도 | 위반 시 |
|---|---|---|
| AI 챗 횟수 | **50회/일** (사용자별, KST) | HTTP 429 + `chat_daily_limit_exceeded` |
| AI 챗 토큰 | **50,000 tokens/일** | HTTP 429 + `chat_token_limit_exceeded` |
| 모의 주문 | **20회/일** (사용자별) | HTTP 429 + `order_daily_limit_exceeded` |
| 분당 버스트 | **5건/분** (챗·주문 공통) | HTTP 429 + `*_burst_limit_exceeded` |
| 시스템 비용 | **$5.00/일** (전체 사용자 합산) | HTTP 503 + `system_cost_breaker_open`, Retry-After: 3600 |

**3중 방어선**: 미들웨어(즉시 차단·LLM 호출 0) → DB UNIQUE(idempotency) → DB 트리거(최후 방어)

---

## 8. 설치/검증 SQL

```sql
-- 전체 테이블 개수 확인 (24개)
SELECT COUNT(*) FROM information_schema.tables
 WHERE table_schema = 'public';

-- 모듈 06 핵심 확인
SELECT column_name FROM information_schema.columns
 WHERE table_name='chat_history'
   AND column_name IN ('input_tokens','output_tokens','cost_usd');
-- → 3행

SELECT * FROM system_cost_today();
-- → 오늘 누적 비용/토큰/호출수

SELECT * FROM usage_today_chat('<user_uuid>');
SELECT * FROM usage_today_orders('<user_uuid>');

-- 트리거 확인
SELECT trigger_name, event_object_table
  FROM information_schema.triggers
 WHERE event_object_table IN ('chat_history','user_orders');
-- → trg_chat_history_rate_limit, trg_user_orders_rate_limit 포함

-- daily_cost_log 최근 7일
SELECT * FROM daily_cost_log ORDER BY log_date DESC LIMIT 7;
```

---

## 9. 자주 쓰는 운영 쿼리

```sql
-- 오늘 가장 많이 챗한 사용자 Top 10
SELECT user_id, COUNT(*) AS chats, SUM(cost_usd) AS cost
  FROM chat_history
 WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Seoul')
 GROUP BY user_id ORDER BY chats DESC LIMIT 10;

-- 종목별 위험 신호 활성 카운트
SELECT s.ticker, s.stock_name,
       COUNT(w.id) FILTER (WHERE w.is_active) AS active_warnings
  FROM stocks s
  LEFT JOIN stock_warnings w ON s.ticker = w.ticker
 GROUP BY s.ticker, s.stock_name
 HAVING COUNT(w.id) FILTER (WHERE w.is_active) > 0
 ORDER BY active_warnings DESC;

-- FSS 콘텐츠 적재 진행률
SELECT * FROM v_fss_ingest_status;

-- 사용자별 모의 보유 주문 (status='접수')
SELECT user_id, stock_code, SUM(CASE WHEN order_type='buy' THEN quantity ELSE -quantity END) AS net_qty
  FROM user_orders
 WHERE is_mock = TRUE AND status = '접수'
 GROUP BY user_id, stock_code
HAVING SUM(CASE WHEN order_type='buy' THEN quantity ELSE -quantity END) > 0;

-- 30일 경과 대화 (아카이브 대상)
SELECT COUNT(*) FROM chat_history
 WHERE created_at < NOW() - INTERVAL '30 days';
```

---

*문서 생성: 2026-06-01 / 스키마 버전: 01~06 (Beta Safeguards 포함)*
