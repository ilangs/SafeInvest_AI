# SafeInvest AI — DB 스키마

> **대상** : 신규 Supabase 프로젝트에 SafeInvest AI 를 배포하는 팀원
> **구성** : 5개 모듈 SQL + SCHEMA README

---

## 무엇이 들어 있나

5개 SQL 파일을 **순서대로** 실행하면 전체 DB(20개 테이블 + 8개 함수 + 1개 뷰 + RLS 정책 + 트리거)가 한 번에 구축됩니다.

| 순서 | 파일 | 모듈 | 핵심 내용 |
|---|---|---|---|
| 1 | `01_foundation.sql` | 기반 시설 | PostgreSQL 확장(uuid-ossp/vector/moddatetime) + 공통 트리거 + 사용자 기본 테이블 (user_profiles / user_settings / watchlist) + 신규가입 자동 트리거 |
| 2 | `02_kis_credentials.sql` | 🔐 보안 | KIS API 자격증명 (AES-256 암호화 저장 테이블 user_kis_credentials) |
| 3 | `03_trading.sql` | 매매 | 매매 주문 로그 user_orders (옵티미스틱 잔고 패턴) |
| 4 | `04_market_analysis.sql` | 시장분석 | stocks/prices/financials/warnings + recent_searches + collection_log + 품질검증 보고서 + QC 함수 3개 + 레거시 호환 stock_companies/risk_flags |
| 5 | `05_ai_education.sql` | AI · 교육 | chat_history + knowledge_chunks/embeddings + fss_contents + stock_terms (백과사전) + study_logs + 검색 RPC 3개 + 뷰 1개 |

---

## 실행 절차

### 1단계: SQL 실행 (Supabase Dashboard)

```
Supabase Dashboard → 프로젝트 → SQL Editor → New query
→ 각 파일 내용을 차례로 붙여넣고 Run

  ┌─────────────────────────┐
  │ 1. 01_foundation.sql    │ ← 가장 먼저 (확장·트리거 함수 정의)
  └─────────────────────────┘
              ↓
  ┌─────────────────────────┐
  │ 2. 02_kis_credentials.sql│
  └─────────────────────────┘
              ↓
  ┌─────────────────────────┐
  │ 3. 03_trading.sql       │
  └─────────────────────────┘
              ↓
  ┌─────────────────────────┐
  │ 4. 04_market_analysis.sql│
  └─────────────────────────┘
              ↓
  ┌─────────────────────────┐
  │ 5. 05_ai_education.sql  │
  └─────────────────────────┘
```

각 파일 끝에 `SELECT '...installed...' AS result;` 가 있어 실행 성공 시 화면 하단에 결과가 표시됩니다.

### 2단계: 시드 데이터 (Python)
```bash
cd backend
source .venv/bin/activate     # macOS/Linux
# .venv\Scripts\activate      # Windows

python scripts/seed_stock_data.py            # 종목 마스터 (KOSPI/KOSDAQ)
python scripts/seed_knowledge.py             # RAG 지식 시드 (10개 샘플)
python scripts/seed_fss_contents.py          # FSS 금감원 콘텐츠 (선택)
python scripts/upsert_new_terms.py --apply   # 주식 백과사전 230개
```

### 3단계: 일일 데이터 수집 1회 실행
```bash
cd backend/analysis
python daily_update.py
```
→ stocks 신규상장, stock_prices, stock_financials, stock_warnings 채워짐
→ 완료 후 data_quality_check.py 자동 호출 → 검증 결과가 data_quality_reports 에 저장

---

## 의존 관계 도식

```
        01_foundation
       ┌──────┼──────┐
       │      │      │
       ▼      ▼      ▼
      02     03     04
   (KIS    (매매)  (시장분석)
    자격)
       │
       └─────────────────► 05_ai_education
                          (챗봇·교육·백과사전)
```

- **모든 모듈은 01의 확장(vector, moddatetime) + 공통 함수(update_updated_at) 에 의존**
- 02·03·04 는 서로 독립 (어느 것이 먼저든 무관)
- 05 는 01 의 vector·moddatetime 필요

---

## 정상 설치 확인 쿼리

5개 모듈 모두 실행 후 다음 두 쿼리로 점검:

### 테이블 21개 확인
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

다음 21개가 모두 보여야 정상:

| 모듈 | 테이블 |
|---|---|
| 1 | user_profiles, user_settings, watchlist |
| 2 | user_kis_credentials |
| 3 | user_orders |
| 4 | stocks, stock_prices, stock_financials, stock_warnings, recent_searches, data_collection_log, data_quality_reports, data_quality_items, stock_companies, risk_flags |
| 5 | chat_history, knowledge_chunks, knowledge_embeddings, fss_contents, stock_terms, study_logs |

### 함수 8개 확인
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_updated_at', 'handle_new_user',
    'match_knowledge', 'match_knowledge_fss', 'increment_view_count',
    'qc_check_duplicates', 'qc_check_orphan_tickers', 'qc_null_summary'
  )
ORDER BY routine_name;
-- → 8개 모두 보여야 함
```

---

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| `extension "vector" does not exist` | pgvector 미지원 | Dashboard → Database → Extensions → vector 활성화 |
| `relation "auth.users" does not exist` | Supabase Auth 비활성화 | Dashboard → Authentication → Enable |
| `policy already exists` | 재실행 | 각 모듈은 `DROP POLICY IF EXISTS` 후 CREATE → 안전. 그래도 나면 해당 정책만 수동 DROP |
| 04 실행 후 데이터 비어 있음 | 시드/수집 미실행 | 2~3단계 실행 |
| 05 chat_history INSERT 실패 | 외래키 위반 | 해당 user_id 가 auth.users 에 있는지 확인 |

---

## 정책

- **새 마이그레이션 추가 시**: 해당 모듈 파일에 직접 변경분을 추가 (idempotent 형태로)
- **모든 변경은 재실행 안전해야 함**: `IF NOT EXISTS`, `DROP ... IF EXISTS` + `CREATE`, `CREATE OR REPLACE` 패턴 사용
- **5개 파일은 항상 최종 스키마를 산출**해야 함

---

*SafeInvest AI — DB 스키마 v1.0 (5 모듈 통합본)*
