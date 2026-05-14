## 로컬 테스트 방법

### 1. 백엔드 실행

```bash
cd C:\...\safeInvest\backend
python -m uvicorn main:app --reload --port 8000
```

### 2-1. 프론트엔드 실행 (새 터미널) - 웹 화면

```bash
cd C:\...\safeInvest\frontend
npm run dev
```

브라우저에서 → **http://localhost:5174**


### 2-2. 프론트엔드 실행 (새 터미널) - 모바일 화면

```bash
cd C:\...\safeInvest\frontend
npm run dev -- --host
```

컴퓨터와 핸드폰이 같은 와이파이(Wi-Fi)에 연결된 상태로 
모바일에서 → **Network: http://???.??.?.?:5173/**

---

### 3. 테스트 계정

```bash
https://safeinvest-ai.vercel.app/
e-mail: test@safeinvest.dev
password: Test1234!
```