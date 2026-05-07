# SafeInvest 일일 데이터 업데이트 가이드

## 개요

SafeInvest 의 Supabase 환경에서 동작하는 데이터 수집/검증 파이프라인입니다.

- **`daily_update.py`** — 4 STEP 증분 수집 (신규상장 → 주가 → 재무 → 경고)
- **`data_quality_check.py`** — 9 CHECK 정합성 검사 (Tier 1/2 분리)
- 두 스크립트 모두 **`data_collection_log`** 에 실행 결과를 영구 기록하고,
  같은 날 두 번 실행되면 자동 스킵합니다.

## 파일 구성

```
backend/
├── analysis/
│   ├── daily_update.py             # 증분 데이터 수집 (4 STEP)
│   ├── data_quality_check.py       # 정합성 검사 (9 CHECK, --mode 지원)
│   ├── logs/                       # 실행 로그 (자동 생성)
│   └── DAILY_UPDATE_README.md      # 본 문서
└── schema/
    ├── migration_03_add_collection_log.sql        # data_collection_log 테이블
    ├── migration_06_data_quality_and_extend_financials.sql
    └── migration_08_quality_check_functions.sql   # qc_* RPC 함수
```

## 최초 1회 — DB 마이그레이션 적용

Supabase Dashboard → SQL Editor 에서 **순서대로** 실행:

1. `migration_03_add_collection_log.sql` — `data_collection_log` 테이블
2. `migration_06_data_quality_and_extend_financials.sql` — 재무 컬럼 확장 + reports/items 테이블
3. `migration_08_quality_check_functions.sql` — `qc_check_duplicates`, `qc_check_orphan_tickers`, `qc_null_summary` RPC

> ⚠️ migration_08 미적용 시 CHECK 4·8·9 가 fallback 모드로 동작하며 매우 느려집니다.

## 환경변수 (`backend/.env` — 통합)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=...

# AI / 보안
OPENAI_API_KEY=sk-...
ENCRYPTION_KEY=...
ALLOWED_ORIGINS=...

# 데이터 수집 (analysis/)
DART_API_KEY=...                    # OpenDartReader 용
```

## 의존성 설치

```bash
cd backend
pip install -r requirements.txt
```

## 실행 방법

### 전체 파이프라인 (권장)
```bash
cd backend/analysis
python daily_update.py
```
순서: ① 신규 상장 → ② 주가 증분 → ③ 재무 증분 → ④ 경고 재계산 → ⑤ 정합성 검사 (`--mode auto`)

### 부분 실행 (daily_update.py)
```bash
python daily_update.py --price-only       # 주가만
python daily_update.py --fin-only         # 재무만
python daily_update.py --warn-only        # 경고만 재계산
python daily_update.py --no-fin           # 재무 제외
python daily_update.py --no-quality       # quality check 생략
```

### 정합성 검사 단독 실행 (data_quality_check.py)
```bash
python data_quality_check.py                  # auto: 평일=daily, 일요일=weekly
python data_quality_check.py --mode daily     # Tier 1: 증분 검증 (~30초)
python data_quality_check.py --mode weekly    # Tier 2: 풀 검증 (5~10분)
python data_quality_check.py --mode quick     # 레거시: CHECK 3·5 스킵
```

## 핵심 설계 — 범위 기반 통합 + 같은 날 스킵

### `data_collection_log` 활용

모든 STEP 은 시작 시 **마지막 success 일자** 를 조회하여:
- `last_date >= today` → **즉시 스킵** (같은 날 재실행 시 멱등)
- `last_date < today` → 작업 수행 후 결과를 `data_collection_log` 에 기록

이로써:
- 스케줄러가 같은 날 두 번 발화해도 안전
- GitHub Actions cron 누락 시 다음 실행이 자동으로 catch-up
- 모든 실행 이력이 DB 에 영구 기록되어 감사/모니터링 용이

### STEP 2 (재무) — DART list API 기반 통합 범위 루프

**기존:** 종목별 polling (전체 종목 × 0.3초 sleep + DART 호출 → ~3.5시간)

**현재:**
```
1. last_success 일자 +1 ~ 오늘 범위 결정
2. dart.list(start, end, kind='A') 한 번 호출
3. 분기/반기/사업보고서만 필터 → (ticker × 분기) dedup
4. 해당 건만 finstate_all + 일괄 upsert
5. data_collection_log 기록
```

**효과:** 약 2,500 종목 polling → 신규 공시 종목만 (수십 건) → **3.5h → 5~10분**

### STEP 별 동작 요약

| STEP | 함수 | 동작 |
|---|---|---|
| 1 | `update_prices()` | pykrx 로 KRX OHLCV 증분 수집. 종목별 `MAX(trade_date)+1` 부터. |
| 2 | `update_financials()` | DART list API 로 신규 공시만 추출 → finstate_all upsert. |
| 3 | `update_warnings()` | 각 종목 최신 분기 기준 자본잠식/고부채/3년적자/저매출 자동 판정. |
| 4 | `update_stock_list()` | KOSPI/KOSDAQ 신규 상장 종목 INSERT. |

## 정합성 검사 — 2-Tier 전략

### Tier 1 — `--mode daily` (평일, ~30초~1분)

증분 데이터에 집중. 누적분은 DB 카운트만 확인.

| CHECK | Tier 1 동작 |
|---|---|
| 1. 증분유입 | ✅ 오늘 카운트 + 최신일자 |
| 2. OHLCV 논리 | ✅ **오늘 행만** 검증 |
| 3. 이상치 | ✅ **오늘 음수가격 + 오늘 ±30% 급등락** |
| 4. 결측값 | ✅ **DB RPC `qc_null_summary` 1회** |
| 5. 연속성 | ⏭️ 스킵 (주간만) |
| 6. 재무정합성 | ✅ **오늘 upsert/갱신된 행만** (`updated_at >= TODAY`) |
| 7. 경고일관성 | ✅ 최신 분기 기준 (이미 효율적) |
| 8. 중복 | ✅ **DB RPC `qc_check_duplicates`** (~1초) |
| 9. 참조무결성 | ✅ **DB RPC `qc_check_orphan_tickers`** (~1초) |

### Tier 2 — `--mode weekly` (일요일, 5~10분)

모든 CHECK 풀 검증. CHECK 4·8·9 만 RPC 가속.

| CHECK | Tier 2 동작 |
|---|---|
| 1~3 | 최근 30일 / 최근 7일 (기존 방식) |
| 4 | DB RPC (Tier 1 과 동일) |
| 5 | 5종목 × 60일 연속성 검사 |
| 6 | 전체 재무 행 풀 검증 |
| 7 | 최신 분기 기준 |
| 8, 9 | DB RPC |

### `--mode auto` 자동 판별

`daily_update.py` 가 호출하는 기본 모드:

```python
weekday = datetime.now().weekday()    # 0=월 ~ 6=일
mode = "weekly" if weekday == 6 else "daily"
```

- 월~토 → `daily`
- 일요일 → `weekly`

수동 강제 시 `--mode {daily,weekly,full,quick}` 명시.

## DB RPC 함수 (migration_08)

| 함수 | 용도 | 반환 |
|---|---|---|
| `qc_check_duplicates()` | CHECK 8 — PK 중복 | `(table_name, total, distinct, dup_count)` |
| `qc_check_orphan_tickers()` | CHECK 9 — 참조 무결성 | `(issue_type, orphan_count)` |
| `qc_null_summary()` | CHECK 4 — 핵심 컬럼 NULL 카운트 | `(table, col, null_cnt, total_cnt)` |

세 함수 모두 `STABLE` 마킹 + `service_role` 에 EXECUTE 권한 부여.

## 보고서 조회 예시

```sql
-- 오늘 보고서 헤더
SELECT * FROM data_quality_reports
ORDER BY report_date DESC LIMIT 1;

-- 가장 최근 FAIL/WARN 항목들
SELECT i.check_group, i.check_name, i.grade, i.message
FROM data_quality_items i
JOIN data_quality_reports r ON i.report_id = r.id
WHERE r.report_date = CURRENT_DATE::TEXT
  AND i.grade IN ('FAIL','WARN')
ORDER BY i.check_group;

-- 최근 7일 수집 이력
SELECT collection_type, status, total_count, success_count, fail_count,
       finished_at
FROM data_collection_log
WHERE finished_at >= NOW() - INTERVAL '7 days'
ORDER BY finished_at DESC;
```

## 스케줄 등록 (GitHub Actions)

`.github/workflows/daily_update.yml` 가 평일 18:30 KST 자동 실행.
일요일 18:30 KST 에는 `--mode auto` 가 weekly 검증으로 자동 전환됩니다.

```yaml
on:
  schedule:
    # 평일(월~금) 09:30 UTC = 18:30 KST
    - cron: "30 9 * * 1-5"
  workflow_dispatch: ...
```

> 일요일도 풀 검증을 원하면 `0 9 * * 0` cron 을 추가하거나 별도 워크플로우 신설.

## 예상 소요 시간 (참고)

| 시나리오 | daily_update | quality_check | 합계 |
|---|---|---|---|
| 평일 첫 실행 (last_success=어제) | 1~2분 | 30초~1분 | **2~3분** |
| 평일 catch-up (last_success=일주일 전) | 5~10분 | 30초~1분 | **6~11분** |
| 일요일 (weekly 검증) | 1~2분 | 5~10분 | **6~12분** |
| 같은 날 재실행 | 즉시 스킵 | 즉시 스킵 (또는 짧게) | **수 초** |

> 참고: 2026-04-30 베이스라인 직후 첫 실행은 약 27분 (DART 정기공시 대량 catch-up + Tier 2 풀 검증).

## 마이그레이션 노트 — 원본 SQLite 와의 차이

| SQLite 원본 | Supabase 포팅 |
|---|---|
| `STOCKS.name` | `stocks.stock_name` |
| `STOCK_PRICES.date/open/high/low/close` | `stock_prices.trade_date/open_price/...` |
| `STOCK_FINANCIALS.year/quarter/net_profit` | `stock_financials.fiscal_year/fiscal_quarter/net_income` |
| `is_active=1/0` (INTEGER) | `is_active=true/false` (BOOLEAN) |
| `INSERT OR IGNORE` | `.upsert(..., on_conflict='...')` |
| `executemany` | 청크 분할 후 `.upsert(list)` |
| 무거운 SQL 집계 | DB RPC 함수 (`qc_*`) |
| 종목별 DART polling | DART list API + dart.finstate_all |

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `SUPABASE 환경변수 없음` | `.env` 의 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 확인 |
| `pykrx 미설치` | `pip install pykrx` |
| `OpenDartReader 미설치` | `pip install OpenDartReader` |
| `DART_API_KEY 없음` | `.env` 에 `DART_API_KEY` 추가 (재무 수집 스킵됨) |
| STEP 2 0건 | 해당 범위에 신규 정기공시 없음 → 정상 |
| `RPC qc_check_duplicates 실패` | `migration_08` 미실행 → SQL Editor 에서 실행 |
| `function qc_* does not exist` | 동일 (migration_08 적용 필요) |
| 같은 날 두 번째 실행이 빨리 끝남 | 정상 (`data_collection_log` 기반 자동 스킵) |
| 일요일에만 풀 검증되는데 평일에 강제하고 싶음 | `python data_quality_check.py --mode weekly` |

## 변경 이력 (요약)

| 버전 | 변경점 |
|---|---|
| 초판 | 종목별 polling 기반 STEP 2 / 풀 fetch 기반 9 CHECK |
| **현재** | STEP 2 → DART list API 통합 범위 루프 / data_collection_log 기반 멱등 스킵 / quality_check 2-Tier + DB RPC |
