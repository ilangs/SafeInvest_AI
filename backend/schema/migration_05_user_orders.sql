-- ─────────────────────────────────────────────────────────────────
-- migration_05_user_orders.sql
-- 사용자 주문 로그 (당일 주문내역 — KIS API 지연/누락 보완)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  is_mock       BOOLEAN     NOT NULL DEFAULT TRUE,
  stock_code    TEXT        NOT NULL,
  stock_name    TEXT,
  order_type    TEXT        NOT NULL,           -- 'buy' | 'sell'
  quantity      INTEGER     NOT NULL,
  price         INTEGER     DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT '체결',
  order_id_ext  TEXT,                            -- KIS order ID
  order_date    TEXT        NOT NULL,            -- YYYYMMDD (KST)
  order_time    TEXT        NOT NULL,            -- HHMMSS (KST)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_orders_lookup
  ON user_orders (user_id, is_mock, order_date DESC, order_time DESC);

ALTER TABLE user_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own orders" ON user_orders;
CREATE POLICY "Users manage their own orders"
  ON user_orders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
