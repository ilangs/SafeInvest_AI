
---

# 📈 SafeInvest AI — 프론트엔드 최종 정리 문서

> 주식 투자 학습 앱 프론트엔드 정리 문서
> 빌드: React 19 + Vite 8 | 인증: Supabase Auth | 통신: Axios + REST API | 배포: Vercel | 작성일: 2026.05.14

---

## 📋 목차

1. 프로젝트 개요
2. 기술 스택
3. 폴더 구조
4. 페이지 & 라우팅
5. 컴포넌트 목록
6. 커스텀 훅 & 서비스
7. 환경변수 설정
8. ⚠️ 미사용 파일 정리

---

## 01. 프로젝트 개요

**SafeInvest AI**는 주식 투자 **초보자**를 위한 학습 중심 웹 애플리케이션입니다. 실제 시세 데이터와 모의 투자 기능을 결합해, 리스크 없이 투자 경험을 쌓을 수 있는 환경을 제공합니다.

| 항목 | 내용 |
| --- | --- |
| 앱 이름 | SafeInvest AI (마스코트: Ju-Dy / 주디) |
| 타겟 사용자 | 주식 투자 초보자 |
| 배포 플랫폼 | Vercel (PWA 지원) |
| 디자인 컨셉 | 홈 화면 = 빨간 계열, 나머지 = 초록 계열 |

### 주요 기능 요약

- **교육센터** — 1~4단계 커리큘럼, 주식 용어사전, 초보자 가이드
- **마켓 분석** — 종목 검색 후 개요·가격·기술·재무·안전 탭 분석
- **주식 매매** — 실시간 캔들차트·호가창·모의 주문 (KIS API 연동)
- **AI 챗봇** — Financial AI Tutor, 학습 질문 도우미
- **Study Log** — 학습 일기 작성 / 수정 / 삭제
- **계좌 연결** — KIS 실계좌 / 모의계좌 AppKey 등록
- **공지사항 & FAQ** — 정적 콘텐츠, 카테고리 필터

---

## 02. 기술 스택

| 분류 | 라이브러리 / 도구 | 비고 |
| --- | --- | --- |
| 프레임워크 | React 19 | Vite 8 번들러 |
| 라우팅 | react-router-dom v7 | SPA 클라이언트 라우팅 |
| 인증 | Supabase Auth | 이메일 / 비밀번호 |
| HTTP 통신 | Axios | JWT 자동 주입 인터셉터 |
| 주식 차트 | lightweight-charts v5 | 캔들/라인 차트 |
| 보조 차트 | Chart.js + react-chartjs-2 | 재무 분석 그래프 |
| 마크다운 렌더링 | react-markdown + remark-gfm | 교육 콘텐츠 표시 |
| PWA | vite-plugin-pwa | 오프라인 캐싱 |
| 배포 | Vercel | vercel.json SPA 리다이렉트 설정 |

```bash
# 개발 서버 실행
npm install
npm run dev        # http://localhost:5173

# 프로덕션 빌드
npm run build
npm run preview
```

---

## 03. 폴더 구조

> ⚠️ 취소선 표시된 파일은 미사용으로 확인된 파일입니다. (섹션 08 참고)

```
frontend/
├── index.html
├── vite.config.js          # PWA 설정 포함
├── eslint.config.js
├── vercel.json             # SPA 리다이렉트 설정
├── .env.example            # 환경변수 템플릿
│
├── public/                 # 정적 이미지 에셋
│   ├── judy_main.png       # 홈 메인 캐릭터 이미지
│   ├── login_logo.png
│   ├── Beginner.png        # 교육 배너 이미지
│   └── favicon.svg
│
└── src/
    ├── main.jsx            # 앱 진입점
    ├── App.jsx             # 라우터 정의, PrivateRoute
    ├── index.css           # 전역 스타일 (다크모드 포함)
    ├── App.css
    │
    ├── pages/
    │   ├── LoginPage.jsx           ← 공개 (로그인/회원가입)
    │   ├── HomePage.jsx
    │   ├── EducationPage.jsx
    │   ├── ContentViewerPage.jsx
    │   ├── MarketAnalysisPage.jsx
    │   ├── TradePage.jsx
    │   ├── AiChatPage.jsx
    │   ├── StudyLogPage.jsx
    │   ├── MyPage.jsx
    │   ├── NoticePage.jsx
    │   ├── FaqPage.jsx
    │   └── DashboardPage.jsx       ← ⚠️ 미사용 (Navbar에 없음)
    │
    ├── components/
    │   ├── layout/
    │   │   └── Navbar.jsx
    │   ├── common/
    │   │   ├── Logo.jsx
    │   │   └── ScrollToTop.jsx
    │   ├── ai/
    │   │   ├── ChatWidget.jsx
    │   │   └── LinkButton.jsx
    │   ├── education/
    │   │   ├── BeginnerGuide.jsx
    │   │   └── StockDictionary.jsx
    │   ├── market/
    │   │   ├── QuoteWidget.jsx
    │   │   └── WatchlistWidget.jsx  ← ⚠️ DashboardPage에서만 사용
    │   ├── analysis/
    │   │   ├── AnalysisHome.jsx
    │   │   ├── AnalysisDetail.jsx
    │   │   ├── shared/
    │   │   │   ├── Expander.jsx
    │   │   │   ├── ExplainBox.jsx
    │   │   │   ├── GradeBadge.jsx
    │   │   │   ├── MetricCard.jsx
    │   │   │   └── PlotlyChart.jsx
    │   │   └── tabs/
    │   │       ├── TabOverview.jsx
    │   │       ├── TabPrice.jsx
    │   │       ├── TabTechnical.jsx
    │   │       ├── TabFinancial.jsx
    │   │       ├── TabSafety.jsx
    │   │       └── TabBeginner.jsx
    │   └── trading/
    │       ├── CandleChart.jsx       ← TradePage에서 사용
    │       ├── Orderbook.jsx         ← TradePage에서 사용
    │       ├── OrderForm.jsx
    │       ├── BalanceWidget.jsx
    │       ├── HoldingsWidget.jsx
    │       ├── StockInfoWidget.jsx
    │       ├── TodayOrdersWidget.jsx
    │       ├── ChartWidget.jsx       ← ⚠️ 미사용
    │       └── OrderbookWidget.jsx   ← ⚠️ 미사용
    │
    ├── hooks/
    │   ├── useAuth.js
    │   ├── usePolling.js
    │   └── useStockName.js
    │
    ├── services/
    │   ├── api.js            # Axios 인스턴스 (JWT 인터셉터)
    │   ├── supabase.js       # Supabase 클라이언트
    │   └── analysisApi.js    # 마켓분석 전용 API + 포맷 유틸
    │
    └── utils/
        └── format.js         # 원화/거래량/등락률/날짜 포맷
```

---

## 04. 페이지 & 라우팅

모든 페이지는 `PrivateRoute`로 감싸져 있어 로그인하지 않으면 `/`(로그인 페이지)로 리다이렉트됩니다.

### 라우트 목록

| 경로 | 컴포넌트 | 설명 | 접근 |
| --- | --- | --- | --- |
| `/` | LoginPage | 이메일/비밀번호 로그인, 회원가입 | 공개 |
| `/home` | HomePage | 환영 화면, 기능 바로가기 카드 | 로그인 필요 |
| `/education` | EducationPage | 1~4단계 커리큘럼 목록, 용어사전, 초보자 가이드 | 로그인 필요 |
| `/education/content/:slno` | ContentViewerPage | 교육 콘텐츠 상세 뷰어 + 인라인 AI 채팅 | 로그인 필요 |
| `/education/self/:slno` | ContentViewerPage | 자기학습 콘텐츠 뷰어 (같은 컴포넌트, 다른 API) | 로그인 필요 |
| `/market` | MarketAnalysisPage | 종목 검색 후 탭별 분석 (개요·가격·기술·재무·안전) | 로그인 필요 |
| `/trade` | TradePage | 실시간 캔들차트, 호가창, 모의/실계좌 주문 | 로그인 필요 |
| `/ai-chat` | AiChatPage | Financial AI Tutor 전용 채팅 페이지 | 로그인 필요 |
| `/study-log` | StudyLogPage | 학습일지 CRUD, 페이지네이션 | 로그인 필요 |
| `/mypage` | MyPage | KIS 계좌 연결 (실계좌 / 모의계좌) | 로그인 필요 |
| `/notice` | NoticePage | 공지사항 목록, 카테고리 필터, 상세 모달 | 로그인 필요 |
| `/faq` | FaqPage | 자주 묻는 질문, 키워드 검색 | 로그인 필요 |
| `/dashboard` | DashboardPage | 관심종목 + 현재가 + AI 챗봇 | ⚠️ 숨김 (Navbar 없음) |
| `*` | (redirect) | 정의되지 않은 경로 → `/` 리다이렉트 | — |

### 인증 흐름

```
앱 진입
  → useAuth() 로 Supabase 세션 확인
  → user 있음  → PrivateRoute 통과 → 해당 페이지 렌더링
  → user 없음  → <Navigate to="/" /> 리다이렉트
```

### Navbar 메뉴 구성

홈 | 교육센터 | 마켓분석 | 주식매매 | 계좌 연결 | AI 챗봇 | Study Log | 공지사항 | FAQ

> 💡 홈 화면(`/home`)에서는 빨간 그라데이션 Navbar, 나머지 페이지에서는 초록 계열 Navbar가 적용됩니다.

---

## 05. 컴포넌트 목록

### layout / common

| 컴포넌트 | 설명 |
| --- | --- |
| `Navbar.jsx` | 전체 공통 상단 메뉴. 다크모드 토글 + 햄버거 메뉴 포함 |
| `ScrollToTop.jsx` | 라우트 변경 시 페이지 최상단 자동 스크롤 |
| `Logo.jsx` | 앱 로고 이미지 컴포넌트 |

### ai

| 컴포넌트 | 설명 |
| --- | --- |
| `ChatWidget.jsx` | AI 챗봇 채팅창. 메시지 송수신, 로딩 상태, 링크 버튼 포함 |
| `LinkButton.jsx` | AI 답변 내 "자세히 알아보기" 외부 링크 버튼. ChatWidget에서만 사용 |

### education

| 컴포넌트 | 설명 |
| --- | --- |
| `BeginnerGuide.jsx` | 초보자 입문 가이드 카드. 단계별 설명과 이미지 표시 |
| `StockDictionary.jsx` | 주식 용어사전. 키워드 검색 + 카테고리 필터 기능 |

### market

| 컴포넌트 | 설명 |
| --- | --- |
| `QuoteWidget.jsx` | 종목 현재가 위젯. 실시간 가격·등락률 표시 |
| `WatchlistWidget.jsx` | 관심종목 목록 위젯. DashboardPage에서만 사용 중 |

### analysis (마켓 분석 전용)

| 컴포넌트 | 설명 |
| --- | --- |
| `AnalysisHome.jsx` | 종목 검색 홈. 전체 종목 리스트 + 최근 검색 표시 |
| `AnalysisDetail.jsx` | 종목 선택 후 탭 전환 컨테이너 |
| `TabOverview.jsx` | 기업 개요 탭. 기본 정보 + AI 분석 요약 |
| `TabPrice.jsx` | 가격 분석 탭. 차트 + 가격 지표 |
| `TabTechnical.jsx` | 기술 분석 탭. 이동평균 등 기술 지표 |
| `TabFinancial.jsx` | 재무 분석 탭. PER·PBR·ROE 등 재무 지표 |
| `TabSafety.jsx` | 안전 점수 탭. 투자 위험 지표 |
| `TabBeginner.jsx` | 초보자용 요약 탭. 쉬운 설명으로 분석 정보 제공 |

### analysis/shared (공유 UI)

| 컴포넌트 | 설명 |
| --- | --- |
| `Expander.jsx` | 펼치기/접기 UI |
| `ExplainBox.jsx` | 지표 설명 박스 |
| `GradeBadge.jsx` | 등급 배지 (A/B/C 등) |
| `MetricCard.jsx` | 수치 지표 카드 |
| `PlotlyChart.jsx` | Plotly 차트 래퍼 |

### trading (주식 매매)

| 컴포넌트 | 상태 | 설명 |
| --- | --- | --- |
| `CandleChart.jsx` | ✅ 사용 중 | lightweight-charts 기반 캔들스틱 차트. 일/주/월 전환 |
| `Orderbook.jsx` | ✅ 사용 중 | 실시간 호가창. 매수/매도 10단계 호가 표시 |
| `OrderForm.jsx` | ✅ 사용 중 | 매수/매도 주문 입력 폼 |
| `BalanceWidget.jsx` | ✅ 사용 중 | 잔고 현황. 총 자산·가용 현금 표시 |
| `HoldingsWidget.jsx` | ✅ 사용 중 | 보유 종목. 수익률·평균 단가 표시 |
| `StockInfoWidget.jsx` | ✅ 사용 중 | 종목 기본 정보. 현재가·시가·고가·저가 |
| `TodayOrdersWidget.jsx` | ✅ 사용 중 | 당일 주문 내역. 체결/미체결 목록 |
| `ChartWidget.jsx` | ⚠️ 미사용 | CandleChart.jsx로 대체됨 |
| `OrderbookWidget.jsx` | ⚠️ 미사용 | Orderbook.jsx로 대체됨 |

---

## 06. 커스텀 훅 & 서비스

### 커스텀 훅 (hooks/)

#### `useAuth.js`

Supabase 세션을 구독하고 인증 상태를 앱 전체에 공유합니다.

```js
const { user, session, loading, signOut } = useAuth()
```

- `getSession()` 으로 초기 로딩 완료 후 `loading = false`
- `onAuthStateChange` 로 로그인/로그아웃 이벤트 실시간 반영
- `signOut()` 호출 시 Supabase 세션 삭제

#### `usePolling.js`

`setInterval` 기반 주기적 데이터 갱신 훅입니다.

```js
const { data, loading, error, refresh } = usePolling(fetchFn, intervalMs)
```

- 기본 갱신 주기: 5,000ms
- 컴포넌트 언마운트 시 자동 인터벌 정리

#### `useStockName.js`

종목코드 → 기업명 변환 훅. 모듈 캐시로 중복 요청을 방지합니다.

```js
const name = useStockName('005930') // → "삼성전자"
```

- 조회 순서: 모듈 캐시 → Supabase DB (`/api/v1/stocks/{code}`) → KIS API 폴백

---

### 서비스 (services/)

#### `api.js` — Axios 인스턴스

```js
import api from '../services/api'
api.get('/api/v1/stocks')
```

- 요청 인터셉터: Supabase JWT 토큰 자동 주입 (`Authorization: Bearer ...`)
- 401 응답 시 자동 로그아웃 없이 각 컴포넌트에서 개별 처리

#### `supabase.js` — Supabase 클라이언트

```js
import { supabase } from '../services/supabase'
supabase.auth.signInWithPassword({ email, password })
```

#### `analysisApi.js` — 마켓 분석 전용 API

| 함수 | 엔드포인트 | 설명 |
| --- | --- | --- |
| `api.stocks()` | `GET /api/v1/stocks` | 전체 종목 리스트 |
| `api.stockInfo(ticker)` | `GET /api/v1/stocks/:t` | 종목 기본 정보 |
| `api.stockScore(ticker)` | `GET /api/v1/stocks/:t/score` | 안전 점수 |
| `api.stockFinancials(ticker)` | `GET /api/v1/stocks/:t/financials` | 재무 지표 |
| `api.stockPrices(ticker)` | `GET /api/v1/stocks/:t/prices` | 가격 히스토리 |
| `api.stockWarnings(ticker)` | `GET /api/v1/stocks/:t/warnings` | 위험 경고 |
| `api.aiAnalysis(ticker)` | `POST /api/v1/stocks/:t/ai` | AI 분석 요청 |
| `api.recentSearches()` | `GET /api/v1/recent-searches` | 최근 검색 목록 |
| `api.addRecent(ticker)` | `POST /api/v1/recent-searches/:t` | 최근 검색 추가 |

포맷 유틸 함수도 함께 포함:

```js
fmtMoney(v)   // 1억 → "1억원", 1조 → "1.0조원"
fmtPrice(v)   // 숫자 → "68,700원"
fmtRatio(v)   // 숫자 → "12.3%"
```

---

### 유틸 (utils/)

#### `format.js`

```js
formatKRW(amount)       // 1500000000000 → "1.5조"
formatVolume(vol)       // 2500000 → "2.5M"
formatChange(rate)      // 2.1 → "+2.10%"
formatChartDate(date)   // "2024-05-14" → "05/14"
```

---

## 07. 환경변수 설정

로컬 개발 시 `.env.example`을 복사해 `.env.local`로 저장하고 실제 값을 입력합니다.
Vercel 배포 시에는 **Settings → Environment Variables**에 입력합니다.

| 변수명 | 설명 | 확인 위치 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public 키 | 동일 위치 |
| `VITE_API_BASE_URL` | 백엔드 API 베이스 URL | 로컬: `http://localhost:8000` / 운영: Render URL |

```bash
# .env.local 예시
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_API_BASE_URL=http://localhost:8000
```

> ⚠️ Vite에서 환경변수는 반드시 `VITE_` 접두사로 시작해야 브라우저에서 접근 가능합니다.
> `.env.local` 파일은 `.gitignore`에 포함되어 있으므로 절대 커밋하지 마세요.

---

## 08. ⚠️ 미사용 파일 정리 권고

코드 분석 결과, 실제 화면에서 사용되지 않는 파일들이 확인되었습니다.

| 파일 경로 | 문제 | 권장 조치 |
| --- | --- | --- |
| `src/components/trading/ChartWidget.jsx` | TradePage가 `CandleChart.jsx`를 직접 import. 이 파일은 어디서도 import되지 않음 | 삭제 |
| `src/components/trading/OrderbookWidget.jsx` | TradePage가 `Orderbook.jsx`를 직접 import. 이 파일은 어디서도 import되지 않음 | 삭제 |
| `src/pages/DashboardPage.jsx` | `/dashboard` 라우트가 `App.jsx`에 정의되어 있으나 Navbar에 링크 없음. 사용자 접근 불가 | 삭제 or Navbar에 메뉴 추가 |
| `src/components/market/WatchlistWidget.jsx` | `DashboardPage`에서만 사용. 위 DashboardPage가 미사용이므로 사실상 함께 미사용 | DashboardPage 처리에 따라 결정 |

### 정리 후 유효 파일 수

| 분류 | 정리 전 | 정리 후 |
| --- | --- | --- |
| Pages | 12개 | 11개 |
| Components | 30개 | 26개 |
| Hooks | 3개 | 3개 (모두 사용 중) |
| Services / Utils | 4개 | 4개 (모두 사용 중) |

---

*📄 SafeInvest AI Frontend Documentation · 작성일 2026.05.14*