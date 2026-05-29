-- ════════════════════════════════════════════════════════════════════════════
-- SafeInvest AI — 배포 모듈 6 : Beta Safeguards (베타 오픈 안전벨트)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 📌 이 모듈이 하는 일
--   교육 수료 후 베타 사용자 오픈을 앞두고, 다중 사용자 환경에서 시스템과
--   비용을 보호하기 위한 "안전벨트" 를 한 번에 도입한다.
--
--   ── Phase 1 : 횟수·중복 방어 ──
--   [1] chat_history  : LLM 토큰/비용 추적 컬럼 추가
--   [2] user_orders   : idempotency_key UNIQUE 추가 (더블클릭/재시도 중복 차단)
--   [3] 일일 사용량 RPC : usage_today_chat / usage_today_orders
--       - chat 은 횟수 + 토큰 두 기준 함께 반환
--   [4] DB 트리거 (최후 방어선) :
--       - chat_history : 일일 50건 / 분당 5건 초과 INSERT 거부
--       - user_orders  : 일일 20건 / 분당 5건 초과 INSERT 거부
--   [5] chat_history_archive : 30일 이상 대화 이관 대상 테이블
--
--   ── Phase 2 : 토큰·비용 방어 ──
--   [6] daily_cost_log : 시스템 전체 일일 비용 누적 테이블
--   [7] accrue_daily_cost(cost, tokens) RPC
--       - save_history 노드가 호출, daily_cost_log 에 가산
--   [8] system_cost_today() RPC
--       - 미들웨어가 호출, 오늘 누적 비용 + 한도 + 남은 비용 반환
--
-- 📌 선행 조건
--   03_trading.sql, 05_ai_education.sql 까지 적용된 상태.
--
-- 📌 운영 한도 (Free Tier 베타) — 변경 시 본 파일 + rate_limit.py 함께 수정
--   - AI 챗 횟수    : 사용자당 1일 50건
--   - AI 챗 토큰    : 사용자당 1일 50,000 tokens
--   - 모의주문      : 사용자당 1일 20건
--   - 버스트       : 양쪽 모두 1분에 5건
--   - 시스템 비용    : $5.00 / 일 (Circuit Breaker)
--
-- 📌 정상 실행 확인
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='chat_history'
--      AND column_name IN ('input_tokens','output_tokens','cost_usd');
--   → 3행
--
--   SELECT trigger_name FROM information_schema.triggers
--    WHERE event_object_table IN ('chat_history','user_orders');
--   → trg_chat_history_rate_limit, trg_user_orders_rate_limit 포함
--
--   SELECT * FROM system_cost_today();
--   → cost_used / cost_limit / cost_remaining / tokens_used / call_count
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- [1] chat_history : 토큰/비용 추적 컬럼
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE chat_history
    ADD COLUMN IF NOT EXISTS input_tokens  INTEGER,
    ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
    ADD COLUMN IF NOT EXISTS cost_usd      NUMERIC(10, 6);

COMMENT ON COLUMN chat_history.input_tokens  IS 'LLM 입력 토큰 수 (프롬프트+컨텍스트)';
COMMENT ON COLUMN chat_history.output_tokens IS 'LLM 출력 토큰 수';
COMMENT ON COLUMN chat_history.cost_usd      IS '이 대화의 LLM 비용 (USD) — 운영 비용 추적용';


-- ════════════════════════════════════════════════════════════════════════════
-- [2] user_orders : idempotency_key UNIQUE
-- ════════════════════════════════════════════════════════════════════════════
-- 클라이언트가 발급한 키 — 동일 사용자가 같은 키로 두 번 INSERT 시도 시
-- UNIQUE 제약으로 차단되어 더블클릭/네트워크 재시도 중복 주문을 방지.
ALTER TABLE user_orders
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- (user_id, idempotency_key) 단위로 유일 — 키가 NULL 인 행은 제약 영향 없음 (PG 표준)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_orders_idempotency
    ON user_orders (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN user_orders.idempotency_key IS
    '클라이언트 발급 UUID — 중복 주문 INSERT 차단 키 (NULL 허용, 같은 user_id 내 UNIQUE)';


-- ════════════════════════════════════════════════════════════════════════════
-- [3] 사용량 조회 RPC — FastAPI 미들웨어가 호출
-- ════════════════════════════════════════════════════════════════════════════
-- 오늘(KST 기준) 해당 사용자의 사용량 + 한도 + 남은 횟수/토큰을 반환한다.
-- 미들웨어는 이 값을 응답 헤더(X-RateLimit-Remaining)로 노출.

-- ── usage_today_chat : 횟수 + 토큰 동시 반환 ────────────────────────────────
CREATE OR REPLACE FUNCTION usage_today_chat(p_user_id UUID)
RETURNS TABLE (
    used            INT,
    daily_limit     INT,
    remaining       INT,
    tokens_used     INT,
    token_limit     INT,
    token_remaining INT
)
LANGUAGE SQL STABLE AS $$
    WITH agg AS (
        SELECT
            COUNT(*)                                              AS cnt,
            COALESCE(SUM(COALESCE(input_tokens, 0)
                       + COALESCE(output_tokens, 0)), 0)::INT     AS tokens
        FROM chat_history
        WHERE user_id = p_user_id
          AND created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Seoul')
    )
    SELECT
        agg.cnt::INT                              AS used,
        50                                        AS daily_limit,
        GREATEST(0, 50 - agg.cnt)::INT            AS remaining,
        agg.tokens                                AS tokens_used,
        50000                                     AS token_limit,
        GREATEST(0, 50000 - agg.tokens)::INT      AS token_remaining
    FROM agg;
$$;

-- ── usage_today_orders : 횟수 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION usage_today_orders(p_user_id UUID)
RETURNS TABLE (used INT, daily_limit INT, remaining INT)
LANGUAGE SQL STABLE AS $$
    SELECT
        COUNT(*)::INT                    AS used,
        20                               AS daily_limit,
        GREATEST(0, 20 - COUNT(*))::INT  AS remaining
    FROM user_orders
    WHERE user_id = p_user_id
      AND is_mock = TRUE
      AND created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Seoul');
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- [4] 일일/분당 INSERT 한도 트리거 (최후 방어선)
-- ════════════════════════════════════════════════════════════════════════════
-- API 미들웨어를 우회한 직접 INSERT (예: supabase-js 클라이언트 호출) 까지
-- DB 레벨에서 차단. SQLSTATE 'P0001' (raise_exception) 으로 들어옴.

-- ── chat_history : 50/일 + 5/분 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_chat_history_limits()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_today_count INT;
    v_minute_count INT;
    v_daily_limit  CONSTANT INT := 50;
    v_burst_limit  CONSTANT INT := 5;
BEGIN
    SELECT COUNT(*) INTO v_today_count
    FROM chat_history
    WHERE user_id = NEW.user_id
      AND created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Seoul');

    IF v_today_count >= v_daily_limit THEN
        RAISE EXCEPTION 'chat_daily_limit_exceeded: %/% per day', v_today_count, v_daily_limit
            USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_minute_count
    FROM chat_history
    WHERE user_id = NEW.user_id
      AND created_at >= NOW() - INTERVAL '1 minute';

    IF v_minute_count >= v_burst_limit THEN
        RAISE EXCEPTION 'chat_burst_limit_exceeded: %/% per minute', v_minute_count, v_burst_limit
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_history_rate_limit ON chat_history;
CREATE TRIGGER trg_chat_history_rate_limit
    BEFORE INSERT ON chat_history
    FOR EACH ROW EXECUTE FUNCTION enforce_chat_history_limits();


-- ── user_orders : 20/일 (모의) + 5/분 ────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_user_orders_limits()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_today_count INT;
    v_minute_count INT;
    v_daily_limit  CONSTANT INT := 20;
    v_burst_limit  CONSTANT INT := 5;
BEGIN
    -- 실거래는 별도 정책이므로 모의(is_mock=TRUE) 에만 한도 적용
    IF NEW.is_mock IS TRUE THEN
        SELECT COUNT(*) INTO v_today_count
        FROM user_orders
        WHERE user_id = NEW.user_id
          AND is_mock = TRUE
          AND created_at >= (CURRENT_DATE AT TIME ZONE 'Asia/Seoul');

        IF v_today_count >= v_daily_limit THEN
            RAISE EXCEPTION 'order_daily_limit_exceeded: %/% per day', v_today_count, v_daily_limit
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_minute_count
    FROM user_orders
    WHERE user_id = NEW.user_id
      AND created_at >= NOW() - INTERVAL '1 minute';

    IF v_minute_count >= v_burst_limit THEN
        RAISE EXCEPTION 'order_burst_limit_exceeded: %/% per minute', v_minute_count, v_burst_limit
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_orders_rate_limit ON user_orders;
CREATE TRIGGER trg_user_orders_rate_limit
    BEFORE INSERT ON user_orders
    FOR EACH ROW EXECUTE FUNCTION enforce_user_orders_limits();


-- ════════════════════════════════════════════════════════════════════════════
-- [5] chat_history_archive : 오래된 대화 이관 대상 테이블
-- ════════════════════════════════════════════════════════════════════════════
-- backend/scripts/archive_old_chats.py 가 주기적으로 INSERT … SELECT … 후
-- 원본을 DELETE 한다. 트리거를 우회하기 위해 archive 는 별도 테이블.
CREATE TABLE IF NOT EXISTS chat_history_archive (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL,
    question      TEXT NOT NULL,
    answer        TEXT NOT NULL,
    session_id    TEXT,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    cost_usd      NUMERIC(10, 6),
    created_at    TIMESTAMPTZ,
    archived_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_archive_user_date
    ON chat_history_archive (user_id, created_at DESC);

ALTER TABLE chat_history_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "archive_read_self" ON chat_history_archive;
CREATE POLICY "archive_read_self" ON chat_history_archive
    FOR SELECT USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- [6] daily_cost_log : 시스템 전체 일일 비용 누적
-- ════════════════════════════════════════════════════════════════════════════
-- 사용자별 분해는 chat_history.cost_usd 사용. 이 테이블은 Circuit Breaker 의
-- 단일 진실 원본(빠른 합계 조회용).
CREATE TABLE IF NOT EXISTS daily_cost_log (
    log_date       DATE       PRIMARY KEY,         -- KST 자정 기준 일자
    total_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    total_tokens   BIGINT     NOT NULL DEFAULT 0,
    call_count     INTEGER    NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE daily_cost_log IS
    '시스템 전체 LLM 비용 일일 누적 — Circuit Breaker 용. 사용자별 분해는 chat_history.cost_usd 사용';

-- 운영자만 조회 가능 (service_role) — RLS ON 후 정책 미부여 = 모두 차단
ALTER TABLE daily_cost_log ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- [7] accrue_daily_cost : save_history 노드가 호출하는 UPSERT RPC
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION accrue_daily_cost(
    p_cost_usd NUMERIC,
    p_tokens   INTEGER DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::DATE;
BEGIN
    INSERT INTO daily_cost_log (log_date, total_cost_usd, total_tokens, call_count, updated_at)
    VALUES (v_today, p_cost_usd, COALESCE(p_tokens, 0), 1, NOW())
    ON CONFLICT (log_date) DO UPDATE
        SET total_cost_usd = daily_cost_log.total_cost_usd + EXCLUDED.total_cost_usd,
            total_tokens   = daily_cost_log.total_tokens   + EXCLUDED.total_tokens,
            call_count     = daily_cost_log.call_count     + 1,
            updated_at     = NOW();
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- [8] system_cost_today : 미들웨어 Circuit Breaker 가 호출
-- ════════════════════════════════════════════════════════════════════════════
-- 반환 컬럼:
--   cost_used    : 오늘 누적 비용 (USD)
--   cost_limit   : 시스템 한도 (USD)
--   cost_remaining: 남은 비용 (USD)
--   tokens_used  : 오늘 누적 토큰
--   call_count   : 오늘 누적 호출 수
CREATE OR REPLACE FUNCTION system_cost_today()
RETURNS TABLE (
    cost_used      NUMERIC,
    cost_limit     NUMERIC,
    cost_remaining NUMERIC,
    tokens_used    BIGINT,
    call_count     INTEGER
)
LANGUAGE SQL STABLE AS $$
    WITH today AS (
        SELECT (NOW() AT TIME ZONE 'Asia/Seoul')::DATE AS d
    )
    SELECT
        COALESCE(dcl.total_cost_usd, 0)::NUMERIC                AS cost_used,
        5.00::NUMERIC                                            AS cost_limit,
        GREATEST(0, 5.00 - COALESCE(dcl.total_cost_usd, 0))::NUMERIC AS cost_remaining,
        COALESCE(dcl.total_tokens, 0)                            AS tokens_used,
        COALESCE(dcl.call_count, 0)                              AS call_count
    FROM today
    LEFT JOIN daily_cost_log dcl ON dcl.log_date = today.d;
$$;


-- ── ✅ 완료 메시지 ───────────────────────────────────────────────────────────
SELECT 'Beta Safeguards installed (Phase 1 + 2): '
    || '3 cols + 1 unique + 4 RPC + 2 triggers + 2 tables' AS result;
