-- SafeInvest AI Module B -- 재무제표 테이블
-- Supabase SQL Editor에서 실행
-- 참고: stock_companies / risk_flags 는 init.sql 에 이미 존재합니다.

-- 재무제표 (연간/분기)
CREATE TABLE IF NOT EXISTS financial_statements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code        TEXT NOT NULL REFERENCES stock_companies(stock_code),
    fiscal_year       INT  NOT NULL,
    report_type       TEXT NOT NULL CHECK (report_type IN ('annual','Q1','Q2','Q3','Q4')),
    revenue           BIGINT,        -- 매출액 (원)
    operating_profit  BIGINT,        -- 영업이익
    net_income        BIGINT,        -- 순이익
    total_assets      BIGINT,        -- 자산총계
    total_liabilities BIGINT,        -- 부채총계
    total_equity      BIGINT,        -- 자본총계
    debt_ratio        NUMERIC,       -- 부채비율 (%)
    roe               NUMERIC,       -- 자기자본이익률 (%)
    operating_margin  NUMERIC,       -- 영업이익률 (%)
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (stock_code, fiscal_year, report_type)
);

-- RLS
ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financials_read" ON financial_statements
    FOR SELECT USING (auth.role() = 'authenticated');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_financial_stock
    ON financial_statements(stock_code, fiscal_year DESC);
