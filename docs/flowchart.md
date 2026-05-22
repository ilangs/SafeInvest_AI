# SafeInvest AI — 시스템 전체 플로우차트

서비스별 색상 구분: **Frontend=파랑 · Backend=초록 · Supabase=주황 · KIS=빨강 · OpenAI=보라**

```mermaid
flowchart TD
    %% ================= 1. 로그인 =================
    subgraph S1["1. 로그인"]
        L1["사용자: 이메일·비밀번호 입력<br/>LoginPage.jsx"]:::fe
        L2["Supabase Auth<br/>signInWithPassword"]:::sb
        L3["JWT 발급 (ES256/HS256)<br/>localStorage 세션 저장"]:::sb
        L4["api.js: 이후 모든 요청<br/>Authorization 헤더 자동 주입"]:::fe
        L1 --> L2 --> L3 --> L4
    end

    %% ============= 2. KIS 계좌 연결 =============
    subgraph S2["2. KIS 계좌 연결"]
        K1["마이페이지: APP KEY·SECRET·계좌번호 입력<br/>MyPage.jsx"]:::fe
        K2["POST /api/v1/credentials/connect<br/>credentials.py"]:::be
        K3["KIS 모의 도메인 토큰 발급 선검증<br/>get_access_token_with_key"]:::kis
        K4["encryption.py: AES-256(Fernet) 암호화"]:::be
        K5[("user_kis_credentials<br/>enc_app_key / enc_app_secret")]:::sb
        K1 --> K2 --> K3
        K3 -->|검증 성공| K4 --> K5
        K3 -.->|실거래 키 / 검증 실패| K2
    end

    %% ============ 3. 시세·차트 조회 ============
    subgraph S3["3. 시세 / 차트 조회"]
        Q1["TradePage: 5초 폴링<br/>usePolling / QuoteWidget"]:::fe
        Q2["GET /api/v1/market/quote · chart<br/>market.py"]:::be
        Q3["user_kis_credentials 에서<br/>access_token 복호화·조회"]:::sb
        Q4["KIS REST API 호출<br/>kis_client.py"]:::kis
        Q5["현재가 · OHLCV 응답<br/>CandleChart 렌더"]:::fe
        Q1 --> Q2 --> Q3 --> Q4 --> Q5 --> Q1
    end

    %% ============== 4. 주문 실행 ==============
    subgraph S4["4. 주문 실행"]
        O1["호가창 가격 클릭<br/>Orderbook.jsx"]:::fe
        O2["주문창: 수량·가격 확정<br/>OrderForm.jsx"]:::fe
        O3["POST /api/v1/order<br/>order.py"]:::be
        O4["거래시간 / 실거래 차단 검사<br/>_is_market_open · REAL_TRADING_ENABLED"]:::be
        O5["KIS 주문 TR 전송<br/>place_order"]:::kis
        O6[("user_orders<br/>status: 접수 → 체결")]:::sb
        O1 --> O2 --> O3 --> O4
        O4 -->|통과| O5 --> O6
        O4 -.->|장 외 / 실거래| O2
    end

    %% =============== 5. AI Q&A ===============
    subgraph S5["5. AI Q&A"]
        A1["AI 챗봇: 질문 입력<br/>ChatWidget.jsx"]:::fe
        A2["POST /api/v1/ai/chat<br/>ai.py → chatbot_graph.py"]:::be
        A3["RAG 검색: knowledge_embeddings<br/>match_knowledge RPC"]:::sb
        A4["GPT-4o-mini 답변 생성<br/>OpenAI API"]:::oai
        A5[("chat_history<br/>대화·출처 저장")]:::sb
        A6["답변 + 출처 URL 표시"]:::fe
        A1 --> A2 --> A3 --> A4 --> A2
        A2 --> A5
        A2 --> A6
    end

    %% 전체 흐름 연결
    L4 --> K1
    L4 --> Q1
    L4 --> O1
    L4 --> A1

    %% ================= 색상 정의 =================
    classDef fe  fill:#3b82f6,stroke:#1d4ed8,color:#fff;
    classDef be  fill:#22c55e,stroke:#15803d,color:#fff;
    classDef sb  fill:#f59e0b,stroke:#b45309,color:#fff;
    classDef kis fill:#ef4444,stroke:#b91c1c,color:#fff;
    classDef oai fill:#a855f7,stroke:#7e22ce,color:#fff;
```

## 범례

| 색상 | 서비스 | 역할 |
|---|---|---|
| 🔵 파랑 | Frontend (React) | 사용자 UI · 입력 · 렌더링 |
| 🟢 초록 | Backend (FastAPI) | 인증·검증·비즈니스 로직·중계 |
| 🟠 주황 | Supabase | DB · Auth · pgvector · RLS |
| 🔴 빨강 | KIS API | 시세·차트·주문·잔고 (한국투자증권) |
| 🟣 보라 | OpenAI API | 임베딩 · GPT-4o 답변 생성 |
