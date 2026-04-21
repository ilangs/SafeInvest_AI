# Render.com 배포 환경변수 체크리스트

## 배포 전 확인 사항

### 1. Render Dashboard 설정
- Service 이름: `safeinvest-ai-backend`
- Runtime: Python 3.12
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Root Directory: `backend/` (모노레포 구조인 경우)

### 2. 필수 환경변수 (Render → Environment 탭 수동 입력)

| 변수명 | 설명 | 예시/주의 |
|--------|------|-----------|
| `SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | Dashboard → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | **비밀 유지 필수** |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret | Dashboard → API → JWT |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `KIS_APP_KEY` | KIS 앱 키 | KIS Developers에서 발급 |
| `KIS_APP_SECRET` | KIS 앱 시크릿 | KIS Developers에서 발급 |
| `KIS_ACCOUNT` | KIS 계좌번호 | `12345678` (8자리) |
| `KIS_MOCK` | 모의투자 여부 | `true` (초기 배포 시 반드시 true) |
| `FASTAPI_SECRET_KEY` | FastAPI 내부 비밀키 | 32자 이상 랜덤 문자열 |
| `PYTHON_VERSION` | Python 버전 | `3.12.0` (render.yaml에 설정됨) |
| `PYTHONPATH` | Python 경로 | `.` (render.yaml에 설정됨) |

### 3. CORS 설정 확인
`backend/main.py` → `allow_origins` 에 프론트엔드 Vercel URL 추가:
```python
allow_origins=["https://your-app.vercel.app", "http://localhost:5173"]
```

### 4. 배포 후 검증
- [ ] `https://your-render-url.onrender.com/health` → `{"status": "ok"}` 확인
- [ ] `https://your-render-url.onrender.com/docs` → Swagger UI 접근 가능
- [ ] `/api/v1/auth/verify` 토큰 없이 → 401 반환
- [ ] Render 로그에서 에러 없음 확인

### 5. KIS 실전 전환 시
- `KIS_MOCK` → `false` 로 변경
- KIS Developers에서 실전투자 앱 별도 생성 필요
- 계좌번호 실계좌로 교체
- **반드시 소액으로 테스트 후 운영**
