# SafeInvest 일일 데이터 업데이트 가이드

## 개요

streamlit 프로젝트의 SQLite 기반 `daily_update.py` / `data_quality_check.py` 를 SafeInvest 의 Supabase 환경으로 포팅한 스크립트입니다.

## 파일 구성

```
backend/
├── analysis/
│   ├── daily_update.py             # 증분 데이터 수집 (4 STEP)
│   ├── data_quality_check.py       # 데이터 정합성 검사 (9 CHECK)
│   ├── logs/                       # 실행 로그 (자동 생성)
│   └── DAILY_UPDATE_README.md      # 본 문서
└── schema/
    └── migration_06_data_quality_and_extend_financials.sql
```

## 최초 1회 — DB 마이그레이션 적용

Supabase Dashboard → SQL Editor 에서 실행:

```sql
-- backend/schema/migration_06_data_quality_and_extend_financials.sql
-- 의 전체 내용 복사 후 실행
```

추가되는 항목:
- `stock_financials` 컬럼 4개: `total_assets`, `total_equity`, `total_liabilities`, `data_source`
- 새 테이블 2개: `data_quality_reports`, `data_quality_items`

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

> ⚠️ 이전에 `backend/analysis/.env` 가 별도로 있었으나 통합되었습니다.
> `daily_update.py` / `data_quality_check.py` 모두 `backend/.env` 를 자동 로드.

## 의존성 설치 (`backend/requirements.txt` — 통합)

```bash
cd backend
pip install -r requirements.txt
```

> 통합된 requirements 에는 FastAPI 서버 + analysis 데이터 수집 패키지가 모두 포함되어 있어
> 한 번 설치하면 서버 운영과 일일 업데이트 양쪽 모두 동작합니다.

## 실행 방법

### 전체 업데이트 (기본)
```bash
cd backend/analysis
python daily_update.py
```
순서: ① 신규 상장 종목 추가 → ② 주가 증분 → ③ 재무 증분 → ④ 경고 재계산 → ⑤ 정합성 검사

### 부분 실행
```bash
python daily_update.py --price-only       # 주가만
python daily_update.py --fin-only         # 재무만
python daily_update.py --warn-only        # 경고만 재계산
python daily_update.py --no-fin           # 재무 제외
python daily_update.py --no-quality       # quality check 생략
```

### 정합성 검사 단독 실행
```bash
python data_quality_check.py              # 전체 9 CHECK
python data_quality_check.py --quick      # CHECK 3·5 생략 (빠른 검사)
```

## STEP 별 동작 요약

### STEP 1 — `update_prices()`
- pykrx 로 KRX OHLCV 수집
- 종목별 `MAX(trade_date)` 다음날부터 오늘까지 증분
- `stock_prices` upsert (PK: `ticker, trade_date`)

### STEP 2 — `update_financials()`
- OpenDartReader 로 DART 분기 보고서 수집
- 신규 분기 INSERT + 기존 NaN 컬럼 catch-up UPDATE
- 분기 스케줄: Q1(5월~), Q2(8월~), Q3(11월~), Q4(다음해 3월~)
- `stock_financials` 의 `total_assets`/`total_equity`/`total_liabilities`/`data_source` 활용

### STEP 3 — `update_warnings()`
- 각 종목의 최신 `(fiscal_year, fiscal_quarter)` 기준 평가
- 4가지 경고 자동 판정: `CAPITAL_IMPAIRMENT`, `HIGH_DEBT`, `CONTINUOUS_LOSS`, `LOW_REVENUE`
- 신규 INSERT / 메시지 갱신 UPDATE / 해소 시 `is_active=false` + `release_date` 기록

### STEP 4 — `update_stock_list()`
- pykrx 로 KOSPI/KOSDAQ 전체 목록 조회
- 신규 상장 종목만 `stocks` 에 INSERT

## CHECK 별 동작 요약 (`data_quality_check.py`)

| # | 검사 그룹 | 내용 |
|---|---|---|
| 1 | 증분유입 | 오늘 주가 수집 건수, 최신 날짜, 재무 최신 분기 |
| 2 | OHLCV논리 | High<Low, 종가=0, 음수 거래량, High<Open/Close |
| 3 | 이상치 | 음수 가격, ±30% 급등락 종목 수 |
| 4 | 결측값 | PRICE/FIN 핵심 컬럼 NULL 비율 |
| 5 | 연속성 | 주요 5종목의 60일 거래일 연속성 |
| 6 | 재무정합성 | 자산=부채+자본, 자본잠식 플래그, ROE 파생값 |
| 7 | 경고일관성 | 자본잠식/고부채 경고 누락, 경고 현황 통계 |
| 8 | 중복 | (ticker,date) / (ticker,year,quarter) 중복 |
| 9 | 참조무결성 | stocks 미등록 ticker, 주가 없는 종목 |

결과는 `data_quality_reports` (헤더) + `data_quality_items` (상세) 두 테이블에 저장.

## 스케줄 등록 예시

### Linux/Mac (crontab)
```bash
# 매일 17시 (장 마감 후)
0 17 * * 1-5 cd /path/to/safeInvest/backend/analysis && python daily_update.py >> logs/cron.log 2>&1
```

### Windows (작업 스케줄러)
```
프로그램: C:\Python312\python.exe
인수:    C:\workAI\TeamProject3\safeInvest\backend\analysis\daily_update.py
시작 위치: C:\workAI\TeamProject3\safeInvest\backend\analysis
트리거:    매일 오후 5시
```

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
```

## 마이그레이션 노트 — 원본 SQLite 와의 차이

| SQLite 원본 | Supabase 포팅 |
|---|---|
| `STOCKS.name` | `stocks.stock_name` |
| `STOCK_PRICES.date/open/high/low/close` | `stock_prices.trade_date/open_price/...` |
| `STOCK_FINANCIALS.year/quarter/net_profit` | `stock_financials.fiscal_year/fiscal_quarter/net_income` |
| `is_active=1/0` (INTEGER) | `is_active=true/false` (BOOLEAN) |
| `capital_impairment=1/0` | `capital_impairment=true/false` |
| `INSERT OR IGNORE` | `.upsert(..., on_conflict='...')` |
| `executemany` | 청크 분할 후 `.upsert(list)` |
| 복잡한 SQL JOIN/GROUP BY | Python pandas 처리 |

## 주의사항

1. **DART API rate limit** — STEP 2 는 종목당 0.3초 sleep. 5,000종목 처리 시 약 25분 소요.
2. **KRX 부하 방지** — STEP 1 은 종목당 0.2초 sleep. 약 17분 소요.
3. **Supabase 무료 플랜 제한** — DB 용량 500MB, 한 번 호출 row 제한 없음. upsert 청크 500.
4. **메모리 사용량** — `data_quality_check.py` CHECK 6/8 은 전체 row 를 메모리에 로드. 재무 ~5만행, 주가 ~150만행 기준 약 500MB.

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| `SUPABASE 환경변수 없음` | `.env` 의 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 확인 |
| `pykrx 미설치` | `pip install pykrx` |
| `OpenDartReader 미설치` | `pip install OpenDartReader` |
| `DART_API_KEY 없음` | `.env` 에 `DART_API_KEY` 추가 (재무 수집 스킵됨) |
| STEP 2 0건 | 분기 가용 시점 미도래 → 정상 |
| migration_06 실행 전 시도 | `column "total_assets" does not exist` 에러 → 마이그레이션 먼저 실행 |
