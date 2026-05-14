-- ════════════════════════════════════════════════════════════════════════════
-- SafeInvest AI — 배포 모듈 3 : Trading (매매 로그)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 📌 이 모듈이 하는 일
--   매수/매도 주문 로그를 저장하는 user_orders 테이블.
--   KIS API 의 매매내역 조회가 체결 직후엔 반영되지 않는 문제를 보완하기 위한
--   "옵티미스틱(낙관적) 잔고" 패턴의 핵심.
--
-- 📌 옵티미스틱 잔고 동작 흐름
--   1) 사용자가 주문 → KIS API 가 주문 접수
--   2) backend/app/services/kis_client._record_local_order()
--      → 이 테이블에 status='접수' 로 즉시 INSERT
--   3) 화면의 보유종목은 KIS 응답 + 이 테이블의 '접수' 주문 = 병합 표시
--   4) 시간 경과 후 KIS API 가 체결 확인 → _sync_local_with_kis_fills()
--      → status 를 '접수' → '체결' 로 UPDATE
--
-- 📌 안전 장치
--   - is_mock 컬럼 : 모의/실거래 분리
--   - RLS : 사용자는 자기 주문만 조회 가능
--   - order_id_ext : KIS 가 발급한 주문 ID (체결 동기화 시 매칭 키)
--
-- 📌 선행 조건
--   01_foundation.sql (auth.users)
--
-- 📌 정상 실행 확인
--   SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_orders';
--   → 1 이어야 함
-- ════════════════════════════════════════════════════════════════════════════

-- ── user_orders : 매매 주문 로그 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL,
    is_mock       BOOLEAN     NOT NULL DEFAULT TRUE,

    -- 거래 정보
    stock_code    TEXT        NOT NULL,           -- 종목코드 (예: '005930')
    stock_name    TEXT,                            -- 종목명 캐시
    order_type    TEXT        NOT NULL,           -- 'buy' | 'sell'
    quantity      INTEGER     NOT NULL,
    price         INTEGER     DEFAULT 0,

    -- 상태 : '접수' (KIS 응답만 받음) | '체결' (실제 체결 확인)
    status        TEXT        NOT NULL DEFAULT '체결',

    -- KIS 주문 ID (체결 확인 시 매칭에 사용)
    order_id_ext  TEXT,

    -- KST 기준 주문 시각
    order_date    TEXT        NOT NULL,            -- YYYYMMDD
    order_time    TEXT        NOT NULL,            -- HHMMSS

    created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ── 조회 인덱스 : 사용자별 최신순 ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_orders_lookup
    ON user_orders (user_id, is_mock, order_date DESC, order_time DESC);


-- ── RLS : 자기 주문만 접근 ───────────────────────────────────────────────────
ALTER TABLE user_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own orders" ON user_orders;
CREATE POLICY "Users manage their own orders"
    ON user_orders
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ── ✅ 완료 메시지 ───────────────────────────────────────────────────────────
SELECT 'Trading module installed: user_orders (optimistic balance pattern)' AS result;
