# 실전 거래 전환 가이드

> **경고**: 실전 거래는 실제 돈이 오가는 작업입니다. 반드시 소액 테스트 후 운영하세요.

## 1. 사전 준비

### 1-1. KIS Developers 실전 앱 등록
1. [KIS Developers](https://apiporduct.koreainvestment.com) 접속 → 로그인
2. **마이페이지 → 앱 관리 → 앱 신청** (모의투자 앱과 별도로 실전투자 앱 생성)
3. 승인 후 **App Key / App Secret** 발급 확인
4. **계좌 연결**: 실전 증권 계좌번호 입력 (8자리, 예: `50123456`)

### 1-2. 환경변수 전환
`.env` 파일 또는 Render Dashboard 환경변수:

```bash
# 모의투자 (현재)
KIS_MOCK=true
KIS_APP_KEY=<모의투자 앱 키>
KIS_APP_SECRET=<모의투자 앱 시크릿>
KIS_ACCOUNT=<모의 계좌번호>

# 실전투자로 전환 시
KIS_MOCK=false
KIS_APP_KEY=<실전투자 앱 키>
KIS_APP_SECRET=<실전투자 앱 시크릿>
KIS_ACCOUNT=<실전 계좌번호 8자리>
```

## 2. TR 코드 자동 전환 확인

`KIS_MOCK=false` 설정 시 `kis_client.py`가 자동으로 실전 TR 코드를 사용합니다:

| 기능 | 모의투자 TR | 실전투자 TR |
|------|------------|------------|
| 잔고 조회 | `VTTC8908R` | `TTTC8908R` |
| 보유종목 조회 | `VTTC8434R` | `TTTC8434R` |
| 매수 주문 | `VTTC0802U` | `TTTC0802U` |
| 매도 주문 | `VTTC0801U` | `TTTC0801U` |
| 현재가 조회 | `FHKST01010100` | `FHKST01010100` (동일) |

## 3. 토큰 관리

KIS OAuth 토큰은 현재 매 요청마다 발급하는 방식입니다.  
**실전 운영 전** 다음 개선을 권장합니다:

```python
# kis_client.py 개선 권장사항
# 1. 토큰 캐싱: Redis 또는 Supabase에 토큰 + 만료시간 저장
# 2. 토큰 만료 전 자동 재발급 (만료 10분 전)
# 3. 토큰 발급 실패 시 재시도 로직 (최대 3회)
```

## 4. 주문 제한 및 안전장치

현재 스키마 제한:
- `quantity`: 1 이상 정수만 허용
- `order_type`: `buy` / `sell` 만 허용 (`hold` 불가)

**추가 권장 안전장치** (실전 전환 시 구현 고려):
```python
# routers/order.py 또는 services/kis_client.py 에 추가
MAX_ORDER_QUANTITY = 100       # 1회 주문 최대 수량
MAX_DAILY_ORDERS = 20         # 일일 주문 횟수 제한
MAX_ORDER_AMOUNT = 1_000_000  # 1회 주문 최대 금액 (원)
```

## 5. 실전 전환 체크리스트

### 전환 전
- [ ] KIS Developers 실전 앱 승인 완료
- [ ] 실전 App Key / Secret 발급
- [ ] 실전 계좌번호 확인 (8자리)
- [ ] Supabase RLS 정책 재검토 (사용자별 데이터 격리 확인)
- [ ] `/health` 엔드포인트에서 `kis_mode: "real"` 표시 확인용 코드 추가 권장

### 전환 후 즉시 확인
- [ ] `/api/v1/account/balance` → 실제 잔고 조회 (금액 일치 여부)
- [ ] `/api/v1/account/holdings` → 실제 보유종목 조회
- [ ] 소량 (1주) 매수 주문 → KIS 앱에서 체결 확인
- [ ] 소량 (1주) 매도 주문 → KIS 앱에서 체결 확인
- [ ] Render 로그에서 KIS API 에러 없음 확인

## 6. 롤백 방법

실전 거래 중 문제 발생 시:
```bash
# Render Dashboard 환경변수에서
KIS_MOCK=true  # 즉시 모의투자로 전환

# 또는 서비스 재배포 (자동 재시작)
```

## 7. 관련 리소스
- KIS Developers 문서: [apiporduct.koreainvestment.com](https://apiporduct.koreainvestment.com)
- KIS API 오류 코드: KIS Developers → 가이드 → 오류코드
- 한국투자증권 고객센터: 1544-5000
