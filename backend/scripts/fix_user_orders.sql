-- ════════════════════════════════════════════════════════════════════════════
-- fix_user_orders.sql — user_orders 기존 데이터 정리 (일회성)
-- ════════════════════════════════════════════════════════════════════════════
--
-- [배경]
--   user_orders 는 앱이 주문 시점에 기록하는 로컬 로그다. 다음 이유로
--   KIS 실제 거래와 어긋난 상태가 발견됐다:
--     1) insert 실패가 silent 무시돼 일부 주문이 누락됨 (코드 수정 완료)
--     2) order_date 가 체결일이 아니라 주문 입력일로 저장됨
--     3) 1개 주문이 KIS 에서 분할 체결 → 주문 수와 거래내역 행 수 불일치
--
-- [목적]
--   KIS 거래내역·계좌잔고로 확인 가능한 명백한 오류만 보정한다.
--   재구성 불가능한 항목(예: 삼성전자 누락분)은 수동 입력 안내로 남긴다.
--
-- [실행 방법]
--   Supabase Dashboard → SQL Editor 에 STEP 단위로 붙여넣어 실행.
--   반드시 STEP 1 로 현재 상태를 먼저 확인한 뒤 STEP 2~ 를 진행할 것.
--   대상 계정: test@safeinvest.dev (필요 시 email 값을 교체)
--
-- [주의]
--   - 5/21 매도 3건의 '접수' → '체결' 전환은 코드(_reconcile_orders_via_balance)
--     가 매매내역 조회 시 자동 처리하므로 이 스크립트에서 다루지 않는다.
--   - INSERT/UPDATE 전 STEP 1 결과를 캡처해 두면 롤백 근거가 된다.
-- ════════════════════════════════════════════════════════════════════════════


-- ── STEP 1. 현재 상태 점검 (먼저 실행, 결과 보관) ───────────────────────────
SELECT id, stock_code, stock_name, order_type, quantity, price,
       status, order_date, order_time, order_id_ext
FROM   user_orders
WHERE  user_id = (SELECT id FROM auth.users WHERE email = 'test@safeinvest.dev')
ORDER  BY order_date, order_time;


-- ── STEP 2. LG전자 매수 수량·단가 보정 ──────────────────────────────────────
--   KIS 거래내역: LG전자(066570) 매수 1주 @154,700 (2026-05-08)
--   DB 오류: 수량 5 / 단가 141,400 → 1 / 154,700 로 정정
UPDATE user_orders
SET    quantity = 1,
       price    = 154700
WHERE  user_id    = (SELECT id FROM auth.users WHERE email = 'test@safeinvest.dev')
  AND  stock_code = '066570'
  AND  order_type = 'buy';


-- ── STEP 3. SK하이닉스 5/11 매수 누락분 추가 ────────────────────────────────
--   사용자 확인: SK하이닉스(000660) 매수 = 5/8 1주 + 5/11 1주 (총 2주)
--   DB 에는 매수 1건만 존재 → 5/11 매수 1주 @1,597,000 추가
--   order_time 은 KIS 거래내역에 시각이 없어 임시값('090000') — 필요 시 조정
INSERT INTO user_orders
  (user_id, is_mock, stock_code, stock_name, order_type,
   quantity, price, status, order_date, order_time)
SELECT id, TRUE, '000660', 'SK하이닉스', 'buy',
       1, 1597000, '체결', '20260511', '090000'
FROM   auth.users
WHERE  email = 'test@safeinvest.dev';


-- ── STEP 4. (선택) order_date 를 KIS 실제 체결일로 보정 ─────────────────────
--   현재 다수 행이 '20260507' 로 저장돼 있으나 실제 체결일은 5/8·5/11.
--   매매내역 표시 정확도를 위해 보정하려면 아래 주석을 해제해 실행.
--
-- UPDATE user_orders
-- SET    order_date = '20260511'
-- WHERE  user_id    = (SELECT id FROM auth.users WHERE email = 'test@safeinvest.dev')
--   AND  stock_code = '012330'             -- 현대모비스 (5/11 체결)
--   AND  order_date = '20260507';
--
-- UPDATE user_orders
-- SET    order_date = '20260508'
-- WHERE  user_id    = (SELECT id FROM auth.users WHERE email = 'test@safeinvest.dev')
--   AND  stock_code = '066570'             -- LG전자 (5/8 체결)
--   AND  order_date = '20260507';


-- ── STEP 5. 삼성전자 누락 거래 — 수동 입력 안내 (자동 보정 불가) ─────────────
--   계좌잔고에 삼성전자(005930) 1주(@218,125)가 있으나 user_orders 에 거래가
--   전혀 없다. KIS 거래내역 조회범위(2026-04-22~05-22) 밖의 거래가 있어
--   정확한 재구성이 불가능 → KIS HTS 거래내역을 직접 확인 후 아래 템플릿으로 입력.
--
-- INSERT INTO user_orders
--   (user_id, is_mock, stock_code, stock_name, order_type,
--    quantity, price, status, order_date, order_time)
-- SELECT id, TRUE, '005930', '삼성전자', 'buy',
--        <수량>, <단가>, '체결', '<YYYYMMDD>', '<HHMMSS>'
-- FROM   auth.users
-- WHERE  email = 'test@safeinvest.dev';


-- ── STEP 6. 정리 후 재점검 ──────────────────────────────────────────────────
SELECT stock_code, stock_name, order_type,
       SUM(CASE WHEN order_type = 'buy'  THEN quantity ELSE 0 END) AS 매수합,
       SUM(CASE WHEN order_type = 'sell' THEN quantity ELSE 0 END) AS 매도합
FROM   user_orders
WHERE  user_id = (SELECT id FROM auth.users WHERE email = 'test@safeinvest.dev')
GROUP  BY stock_code, stock_name, order_type
ORDER  BY stock_code;
-- 종목별 (매수합 − 매도합) 이 KIS 계좌잔고 보유수량과 일치하면 정합 완료.
