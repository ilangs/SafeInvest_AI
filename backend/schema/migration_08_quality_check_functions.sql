-- migration_08_quality_check_functions.sql
-- 데이터 정합성 검사용 PostgreSQL 함수 (Supabase RPC)
--   - data_quality_check.py 의 무거운 풀 스캔 검사를 DB 측에서 단일 SQL 로 실행
--   - 클라이언트는 결과 row 만 받아오므로 네트워크/메모리 부담 격감
--
-- Supabase Dashboard → SQL Editor 에서 실행하세요.

-- ══════════════════════════════════════════════════════════════════════════
-- qc_check_duplicates : 테이블별 PK 중복 검증 (CHECK 8)
--   stock_prices            → (ticker, trade_date)
--   stock_financials        → (ticker, fiscal_year, fiscal_quarter)
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION qc_check_duplicates()
RETURNS TABLE (
    table_name    TEXT,
    total_rows    BIGINT,
    distinct_rows BIGINT,
    dup_count     BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'stock_prices'::TEXT,
           COUNT(*)::BIGINT,
           COUNT(DISTINCT (ticker, trade_date))::BIGINT,
           (COUNT(*) - COUNT(DISTINCT (ticker, trade_date)))::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_financials'::TEXT,
           COUNT(*)::BIGINT,
           COUNT(DISTINCT (ticker, fiscal_year, fiscal_quarter))::BIGINT,
           (COUNT(*) - COUNT(DISTINCT (ticker, fiscal_year, fiscal_quarter)))::BIGINT
      FROM stock_financials;
END;
$$ LANGUAGE plpgsql STABLE;


-- ══════════════════════════════════════════════════════════════════════════
-- qc_check_orphan_tickers : 참조 무결성 (CHECK 9)
--   prices/financials/warnings → stocks 미등록 ticker 카운트
--   stocks → 주가 없는 종목 카운트
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION qc_check_orphan_tickers()
RETURNS TABLE (
    issue_type   TEXT,
    orphan_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'prices_orphan'::TEXT,
           COUNT(DISTINCT p.ticker)::BIGINT
      FROM stock_prices p
      LEFT JOIN stocks s ON p.ticker = s.ticker
      WHERE s.ticker IS NULL
    UNION ALL
    SELECT 'financials_orphan'::TEXT,
           COUNT(DISTINCT f.ticker)::BIGINT
      FROM stock_financials f
      LEFT JOIN stocks s ON f.ticker = s.ticker
      WHERE s.ticker IS NULL
    UNION ALL
    SELECT 'warnings_orphan'::TEXT,
           COUNT(DISTINCT w.ticker)::BIGINT
      FROM stock_warnings w
      LEFT JOIN stocks s ON w.ticker = s.ticker
      WHERE s.ticker IS NULL
    UNION ALL
    SELECT 'no_price_stocks'::TEXT,
           COUNT(*)::BIGINT
      FROM stocks s
      LEFT JOIN stock_prices p ON s.ticker = p.ticker
      WHERE p.ticker IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;


-- ══════════════════════════════════════════════════════════════════════════
-- qc_null_summary : 핵심 컬럼 NULL 카운트 한 번에 (CHECK 4)
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION qc_null_summary()
RETURNS TABLE (
    table_name TEXT,
    col_name   TEXT,
    null_cnt   BIGINT,
    total_cnt  BIGINT
) AS $$
BEGIN
    RETURN QUERY
    -- stock_prices
    SELECT 'stock_prices'::TEXT, 'open_price'::TEXT,
           COUNT(*) FILTER (WHERE open_price  IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'high_price',
           COUNT(*) FILTER (WHERE high_price  IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'low_price',
           COUNT(*) FILTER (WHERE low_price   IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'close_price',
           COUNT(*) FILTER (WHERE close_price IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    UNION ALL
    SELECT 'stock_prices', 'volume',
           COUNT(*) FILTER (WHERE volume      IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_prices
    -- stock_financials
    UNION ALL
    SELECT 'stock_financials', 'revenue',
           COUNT(*) FILTER (WHERE revenue          IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'operating_profit',
           COUNT(*) FILTER (WHERE operating_profit IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'net_income',
           COUNT(*) FILTER (WHERE net_income       IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'total_assets',
           COUNT(*) FILTER (WHERE total_assets     IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'total_equity',
           COUNT(*) FILTER (WHERE total_equity     IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials
    UNION ALL
    SELECT 'stock_financials', 'roe',
           COUNT(*) FILTER (WHERE roe              IS NULL)::BIGINT, COUNT(*)::BIGINT
      FROM stock_financials;
END;
$$ LANGUAGE plpgsql STABLE;


-- ══════════════════════════════════════════════════════════════════════════
-- 권한: service_role 이 호출할 수 있도록 grant
-- ══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION qc_check_duplicates()        TO service_role;
GRANT EXECUTE ON FUNCTION qc_check_orphan_tickers()    TO service_role;
GRANT EXECUTE ON FUNCTION qc_null_summary()            TO service_role;
