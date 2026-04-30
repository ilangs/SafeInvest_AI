## 로컬 테스트 방법

### 1. 백엔드 실행

```bash
cd C:\...\safeInvest\backend
python -m uvicorn main:app --reload --port 8000
```

### 2. 프론트엔드 실행 (새 터미널)

```bash
cd C:\...\safeInvest\frontend
npm run dev
```

브라우저에서 → **http://localhost:5173**

---

### 3. 테스트 시나리오

#### 기본 흐름
| 순서 | 동작 | 확인 포인트 |
|------|------|-------------|
| 1 | `test@safeinvest.dev / Test1234!` 로그인 | → `/education` 자동 이동 |
| 2 | Navbar 우측 **마이페이지** 클릭 | 링크 표시 확인 |
| 3 | `/mypage` | 모의/실거래 카드 2개, 미연결 상태 폼 표시 |
| 4 | "KIS 앱 등록 방법" accordion 클릭 | 안내 내용 펼쳐짐 |
| 5 | **주식거래** 탭 클릭 | 노란 배너 "KIS 계좌 미연결" 표시 |

#### KIS 키 없을 때 — mock 데이터 확인
주식거래 탭에서 키 없이도 모의 데이터(삼성전자, 캔들차트 등)가 정상 표시되는지 확인합니다.

#### KIS 키 있을 때 — 실제 연결
마이페이지에서 APP KEY / APP SECRET / 계좌번호 입력 후 **모의투자 연결하기** 클릭:
- ✅ 성공: "모의투자 계좌 연결 완료 (5012****-01)" 메시지
- ❌ 실패: "KIS 연결 실패. APP KEY/SECRET을 확인하세요." 메시지
- 연결 후 주식거래 탭 재방문 → 노란 배너 사라짐

---

### 4. API 직접 테스트 — Swagger UI

**http://localhost:8000/docs** 에서:

```
[새로 추가된 엔드포인트]
GET  /api/v1/credentials/status    → 연결 상태 조회
POST /api/v1/credentials/connect   → 키 등록
DELETE /api/v1/credentials/{true}  → 모의투자 연결 해제

[파라미터 추가된 엔드포인트]
GET /api/v1/market/quote?symbol=005930&is_mock=true
GET /api/v1/account/balance?is_mock=true
```

> Swagger에서 테스트 시 우측 상단 **Authorize** 버튼 → Supabase JWT 토큰 입력 필요  
> (토큰은 브라우저 개발자 도구 → Application → localStorage → `sb-...auth-token` 에서 확인)

---

### 5. 빠른 암호화 동작 확인

```bash
cd C:\workAI\TeamProject3\safeInvest\backend
python -c "
from app.core.encryption import encrypt, decrypt, mask_account
ct = encrypt('MY_APP_KEY_12345')
print('암호화:', ct[:40], '...')
print('복호화:', decrypt(ct))
print('마스킹:', mask_account('50123456-01'))
"
```




## ✅ E2E 테스트 완료 보고서

**SafeInvest AI — 교육 + 거래 통합 모듈 (2026-04-29)**

---

### 🔐 인증 모듈

| # | 시나리오 | 결과 |
|---|----------|------|
| 1 | 로그인 페이지 진입 (`/`) | ✅ 로그인 카드 렌더링 |
| 2 | `test@safeinvest.dev / Test1234!` 로그인 | ✅ 성공 |
| 3 | 로그인 후 `/education` 자동 리다이렉트 | ✅ 동작 |
| 4 | 미인증 상태에서 `/education` 직접 접근 | ✅ `/`로 차단 |

---

### 📚 교육센터 (`/education`)

| # | 시나리오 | 결과 |
|---|----------|------|
| 5 | 홈 탭 — 히어로 섹션 통계 표시 | ✅ 토픽 수·콘텐츠 수 렌더링 |
| 6 | **기본기 영상** 탭 — 카테고리 필터 | ✅ 6개 카테고리 칩 동작 |
| 7 | **교육 주제** 탭 — 토픽 카드 목록 | ✅ 24개 토픽 표시 |
| 8 | **학습 경로** 탭 — 커리큘럼 카드 | ✅ 12개 경로 표시 |

---

### 🎬 콘텐츠 뷰어

| # | 시나리오 | 결과 |
|---|----------|------|
| 9 | 토픽 클릭 → `TopicDetailPage` | ✅ "투자의 기초" 244개 콘텐츠 |
| 10 | FSS 콘텐츠 클릭 → `ContentViewerPage` | ✅ iframe/플레이어 + AI Tutor 사이드바 |
| 11 | **기본기 영상** 클릭 → `<video>` mp4 플레이어 | ✅ `self_F01_why_invest.mp4` 스트리밍 |
| 12 | AI Tutor — 제안 질문 표시 | ✅ 3개 suggested questions 렌더링 |
| 13 | AI Tutor — GPT-4o-mini 맥락 응답 | ✅ 참고 콘텐츠 포함 답변 생성 |

---

### 🎯 맞춤 학습 경로 매칭

| # | 시나리오 | 결과 |
|---|----------|------|
| 14 | "맞춤 경로 찾기" 진입 | ✅ 2단계 설문 렌더링 |
| 15 | 1단계: 인생단계 선택 | ✅ 8개 옵션, 자동 다음 단계 |
| 16 | 2단계: 목표 선택 → POST 매칭 | ✅ `/api/education/curriculum/match` 호출 |
| 17 | 결과: 매칭 점수 + LLM 추천 이유 | ✅ 최적 추천 1위 강조 표시 |
| 18 | "커리큘럼 보기" → 주차별 아코디언 | ✅ 주차 토글·콘텐츠 목록 |

---

### 📈 주식거래 모듈 (`/trade`)

| # | 시나리오 | 결과 |
|---|----------|------|
| 19 | Navbar "주식거래" 클릭 → `/trade` | ✅ 이동 |
| 20 | 실시간 시세 조회 (삼성전자 005930) | ✅ 현재가 표시 |
| 21 | 캔들스틱 차트 렌더링 | ✅ lightweight-charts v5 |
| 22 | 교육센터 복귀 (`Navbar "교육센터"`) | ✅ active 스타일 정상 |

---

### 🔒 로그아웃

| # | 시나리오 | 결과 |
|---|----------|------|
| 23 | 로그아웃 버튼 클릭 | ✅ `/`로 리다이렉트 |

---

### 📊 종합

| 항목 | 내용 |
|------|------|
| **테스트 항목** | 23개 시나리오 |
| **통과** | ✅ 23 / 23 |
| **실패** | ❌ 0 |
| **백엔드 포트** | `8000` (FastAPI — 거래 + 교육 통합) |
| **프론트엔드 포트** | `5173` (Vite + React) |
| **AI 모델** | GPT-4o-mini (교육 AI Tutor) |
| **영상 스트리밍** | `/static/videos/self_*.mp4` (FastAPI StaticFiles) |

---

**통합 완료 상태**: 교육 모듈(FastAPI 독립앱 → APIRouter 통합), React 6개 신규 페이지, Navbar 통합, 로그인 리다이렉트 수정 모두 정상 동작 확인.

프론트엔드 담당자에게 현재 파일 전달 준비가 되어 있습니다. 🎉