# Vercel 배포 환경변수 체크리스트

## 배포 전 확인 사항

### 1. Vercel 프로젝트 설정
- Framework Preset: **Vite**
- Root Directory: `frontend/` (모노레포 구조인 경우)
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 2. 필수 환경변수 (Vercel → Settings → Environment Variables)

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (공개 가능) | Dashboard → API |
| `VITE_API_BASE_URL` | 백엔드 Render URL | `https://safeinvest-ai-backend.onrender.com` |

> **주의**: `VITE_` 접두사가 없으면 브라우저에서 접근 불가 (Vite 빌드 시 번들에서 제외됨)

### 3. vercel.json 확인
SPA 라우팅을 위한 rewrites 설정이 `frontend/vercel.json`에 포함되어 있어야 합니다:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 4. Supabase Auth 설정 (필수)
Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/**` 추가

### 5. 배포 후 검증
- [ ] `https://your-app.vercel.app/` → 로그인 페이지 표시
- [ ] `/dashboard`, `/trade` → 로그인 없이 접근 시 `/`로 리다이렉트
- [ ] 로그인 후 대시보드 정상 표시 (잔고, 관심종목)
- [ ] AI 채팅 질문 전송 → 응답 수신
- [ ] 주문 폼 → 모의 주문 처리 확인
- [ ] 브라우저 콘솔에 CORS 에러 없음

### 6. 로컬 개발 환경
`frontend/.env.local` (git에 커밋하지 말 것):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:8000
```
