# Render 배포 가이드 (자동 데이터 수집 포함)

✅ Render는 클라우드 서버에서 실행되므로 로컬 PC가 꺼져 있어도:
- **매일 평일 18:30 KST(09:30 UTC)** 에 데이터 수집 자동 실행
- Supabase DB에 자동 업데이트
- `data_quality_check.py`도 후속 자동 실행 → 보고서 저장

단, **최초 1회 Render Dashboard에서 환경변수 설정 필수**입니다.

---

## 1. Render 플랜 선택

| 항목 | 필요 사항 |
|---|---|
| Web Service | Free/Starter 가능 (Free는 15분 idle 후 sleep) |
| **Cron Job** | ⚠️ **Starter 이상 ($7/월)** — Free 플랜은 cron 미지원 |

→ **자동 데이터 수집을 원하면 Starter 이상 필수**

---

## 2. 사전 준비

### (1) GitHub 저장소
- 코드 push (`.env`는 `.gitignore`로 제외됨 — 정상)

### (2) Supabase
- 프로젝트 URL, anon key, service_role key, JWT secret 메모

### (3) DART OpenAPI
- https://opendart.fss.or.kr/ 에서 무료 API 키 발급

### (4) OpenAI
- https://platform.openai.com/ API 키 발급

---

## 3. Render 배포 단계

### Step 1 — 새 서비스 연결

1. https://dashboard.render.com/ → **New +** → **Blueprint**
2. GitHub 저장소 연결 후 `safeInvest` repo 선택
3. **Root Directory** = `backend`
4. Render가 `backend/render.yaml`을 자동 감지하여 **Web + Cron 두 개 서비스** 생성

### Step 2 — 환경변수 입력 (가장 중요)

`.env`는 git에 안 올라가므로 Dashboard에서 **수동 입력**해야 합니다.

#### ① `safeinvest-ai-backend` (Web Service) → Environment 탭

| 키 | 값 출처 |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | 동상 (anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | 동상 (service_role secret) |
| `SUPABASE_JWT_SECRET` | 동상 (JWT Secret) |
| `OPENAI_API_KEY` | OpenAI Platform |
| `ENCRYPTION_KEY` | 32바이트 hex 문자열 (`openssl rand -hex 32`) |
| `FASTAPI_SECRET_KEY` | 임의 강한 랜덤 문자열 |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app,https://...` |

#### ② `safeinvest-daily-collector` (Cron Job) → Environment 탭

| 키 | 값 |
|---|---|
| `SUPABASE_URL` | (Web과 동일) |
| `SUPABASE_SERVICE_ROLE_KEY` | (Web과 동일) ← **필수** RLS 우회용 |
| `DART_API_KEY` | DART에서 발급받은 키 |

> 💡 Render는 같은 Blueprint 내 서비스끼리 **환경변수 공유 그룹(Env Group)** 으로 관리하면 편합니다.

### Step 3 — 배포 트리거

- 환경변수 입력 완료 후 **Manual Deploy** → **Deploy latest commit**
- Web 서비스 빌드 완료 후 `https://safeinvest-ai-backend.onrender.com/docs` 접속 확인
- Cron 서비스는 빌드만 끝나면 다음 스케줄에 자동 실행

---

## 4. Cron 동작 확인 방법

### (A) Render Dashboard
- **Cron Jobs** 탭 → `safeinvest-daily-collector` → **Logs**
- 첫 실행은 다음 평일 18:30 KST에 발생

### (B) 수동 즉시 실행
- Cron 서비스 페이지 → **Trigger Run** 버튼

### (C) Supabase 검증 SQL
```sql
-- 최신 보고서 확인
SELECT report_date, overall_grade, pass_count, warn_count, fail_count
FROM data_quality_reports
ORDER BY report_date DESC
LIMIT 5;

-- 오늘 새로 들어온 주가 데이터
SELECT COUNT(*)
FROM stock_prices
WHERE trade_date = CURRENT_DATE::TEXT;
```

---

## 5. 비용 / 시간 예상

| 항목 | 예상 |
|---|---|
| Render Starter | $7/월 (Web) + $7/월 (Cron) ≈ **$14/월** |
| Cron 실행 시간 | 1회 약 40~60분 (5,000종목 기준) |
| Render Cron 시간 한도 | Starter 플랜: 무제한 (개당 최대 24시간) |
| 월 실행 횟수 | 평일 약 22회 |

> Free 플랜은 Cron 미지원이지만 Web 서비스는 무료로 운영 가능. 데이터 수집은 별도 무료 대안 필요 (예: GitHub Actions cron — 6시간/실행 제한).

---

## 6. 대안 — GitHub Actions로 무료 cron 운영

Render Cron을 쓰지 않고 비용 0원으로 자동화하려면 `.github/workflows/daily_update.yml` 사용 (이미 작성됨).

### 주요 기능
- 매일 평일 18:30 KST 자동 실행
- 수동 실행 버튼(`workflow_dispatch`) 제공 — 5가지 모드 선택 가능
  (`full` / `price-only` / `fin-only` / `warn-only` / `quality-only`)
- Secrets 누락 사전 검증 (디버깅 편의)
- 실행 로그를 Artifacts로 7일간 보관 (다운로드 가능)
- Job Summary로 결과 요약 표시
- 동시 실행 방지 (`concurrency` 그룹)
- 90분 timeout

### Secrets 등록 (필수)

GitHub Repo → **Settings → Secrets and variables → Actions** → **New repository secret**:

| Secret 이름 | 값 |
|---|---|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API의 service_role secret |
| `DART_API_KEY` | DART OpenAPI 키 |

### 동작 확인

1. GitHub repo → **Actions** 탭 클릭
2. 좌측 "Daily Stock Data Update" 워크플로우 선택
3. 우측 **Run workflow** 버튼 → 모드 선택 → Run
4. 실행 후 좌측 run 아이템 클릭하면:
   - 단계별 실행 로그 확인 가능
   - **Artifacts** 섹션에서 `daily-update-logs-XXX.zip` 다운로드 가능
   - 상단 **Summary** 에 실행 결과 요약 표시

### 무료 한도

GitHub Actions Free Tier (Public repo: 무제한 / Private repo):
- **공개 저장소**: 완전 무료, 무제한
- **비공개 저장소**: 월 2,000분 무료
  - 1회 실행 약 60분 × 평일 22회 ≈ 1,320분/월 → **무료 한도 내**

### 시간대 주의

GitHub Actions의 cron은 **UTC** 기준입니다:
- `"30 9 * * 1-5"` → 평일 09:30 UTC = 18:30 KST ✓

서머타임 영향 없음 (한국은 서머타임 미적용).

---

## 7. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| Cron 빌드 실패 `ModuleNotFoundError` | `requirements.txt` 누락 패키지 → `pip install` 재확인 |
| `SUPABASE 환경변수 없음` 에러 | Dashboard → Cron 서비스 Environment 탭 재입력 |
| 60분 넘어 timeout | Render Starter는 24시간 한도. 다른 플랜이면 한도 확인 |
| 실행은 됐는데 데이터 0건 | Supabase RLS 정책 확인 — `service_role_key` 사용 필수 |
| `data_quality_reports` 테이블 없음 | `migration_06_*.sql` 마이그레이션 미실행 |

---

## 8. 권장 운영 흐름

```
GitHub push (코드 변경)
    ↓
Render 자동 빌드 + 배포 (Web)
    ↓
[매일 18:30 KST] Render Cron 자동 실행
    ↓
daily_update.py → Supabase 4개 테이블 업데이트
    ↓
data_quality_check.py → data_quality_reports 저장
    ↓
다음날 사용자가 마켓분석/주식매매 화면 진입 → 최신 데이터 표시
```

로컬 PC가 켜져 있을 필요 **전혀 없음**. 사용자 부재 중에도 매일 자동 갱신.
