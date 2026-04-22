"""
scripts/seed_stock_data.py
코스피 주요 5개 종목의 기본정보 + 재무데이터 샘플 삽입.
실제 운영 시 DART API로 전체 종목 수집 예정.
실행: cd backend && python scripts/seed_stock_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from app.core.supabase import supabase_admin

COMPANIES = [
    {
        "stock_code": "005930",
        "stock_name": "삼성전자",
        "market": "KOSPI",
        "sector": "반도체",
        "business_summary": "메모리·비메모리 반도체, 스마트폰, 가전제품을 설계·제조·판매하는 글로벌 전자기업. D램·낸드플래시 세계 1위 생산업체이며, 갤럭시 스마트폰으로 글로벌 시장을 선도.",
        "per": 33.4,
        "pbr": None,
        "div_yield": 0.76,
        "market_cap": 1280000000000000,
    },
    {
        "stock_code": "000660",
        "stock_name": "SK하이닉스",
        "market": "KOSPI",
        "sector": "반도체",
        "business_summary": "D램·낸드플래시 등 메모리 반도체 전문 기업. HBM(고대역폭 메모리) 분야 세계 1위로 AI 시대 수혜 기업으로 주목받고 있음.",
        "per": 12.1,
        "pbr": 1.8,
        "div_yield": 0.4,
        "market_cap": 130000000000000,
    },
    {
        "stock_code": "035420",
        "stock_name": "NAVER",
        "market": "KOSPI",
        "sector": "인터넷",
        "business_summary": "국내 최대 포털 서비스 및 검색 광고, 쇼핑, 파이낸셜, 웹툰 등 다양한 플랫폼 사업을 운영. 라인야후 지분 보유 및 클라우드·AI 사업 확장 중.",
        "per": 28.5,
        "pbr": 1.6,
        "div_yield": 0.3,
        "market_cap": 30000000000000,
    },
    {
        "stock_code": "005380",
        "stock_name": "현대차",
        "market": "KOSPI",
        "sector": "자동차",
        "business_summary": "국내 1위 자동차 제조사. 현대·기아 브랜드로 글로벌 시장을 공략하며 전기차(아이오닉 시리즈) 전환에 적극 투자 중.",
        "per": 7.2,
        "pbr": 0.7,
        "div_yield": 2.8,
        "market_cap": 50000000000000,
    },
    {
        "stock_code": "207940",
        "stock_name": "삼성바이오로직스",
        "market": "KOSPI",
        "sector": "바이오",
        "business_summary": "글로벌 CMO(위탁생산) 분야 세계 1위 바이오의약품 생산 전문기업. 대규모 생산 설비와 기술력으로 글로벌 제약사들로부터 대규모 수주를 확보.",
        "per": 82.0,
        "pbr": 6.5,
        "div_yield": 0.0,
        "market_cap": 55000000000000,
    },
]

FINANCIALS = [
    # 삼성전자
    {"stock_code": "005930", "fiscal_year": 2024, "report_type": "annual",
     "revenue": 300870000000000, "operating_profit": 32726000000000,
     "net_income": 34399000000000, "total_assets": 516339000000000,
     "total_liabilities": 138139000000000, "total_equity": 378200000000000,
     "debt_ratio": 36.5, "roe": 9.1, "operating_margin": 10.9},
    {"stock_code": "005930", "fiscal_year": 2023, "report_type": "annual",
     "revenue": 258935000000000, "operating_profit": 6567000000000,
     "net_income": 15487000000000, "total_assets": 455905000000000,
     "total_liabilities": 118567000000000, "total_equity": 337338000000000,
     "debt_ratio": 35.1, "roe": 4.6, "operating_margin": 2.5},
    # SK하이닉스
    {"stock_code": "000660", "fiscal_year": 2024, "report_type": "annual",
     "revenue": 66192000000000, "operating_profit": 23467000000000,
     "net_income": 19792000000000, "total_assets": 130000000000000,
     "total_liabilities": 55000000000000, "total_equity": 75000000000000,
     "debt_ratio": 73.3, "roe": 26.4, "operating_margin": 35.5},
    {"stock_code": "000660", "fiscal_year": 2023, "report_type": "annual",
     "revenue": 32766000000000, "operating_profit": -7732000000000,
     "net_income": -7732000000000, "total_assets": 110000000000000,
     "total_liabilities": 50000000000000, "total_equity": 60000000000000,
     "debt_ratio": 83.3, "roe": -12.9, "operating_margin": -23.6},
    # NAVER
    {"stock_code": "035420", "fiscal_year": 2024, "report_type": "annual",
     "revenue": 10017000000000, "operating_profit": 1601000000000,
     "net_income": 902000000000, "total_assets": 35000000000000,
     "total_liabilities": 14000000000000, "total_equity": 21000000000000,
     "debt_ratio": 66.7, "roe": 4.3, "operating_margin": 16.0},
    # 현대차
    {"stock_code": "005380", "fiscal_year": 2024, "report_type": "annual",
     "revenue": 175238000000000, "operating_profit": 14204000000000,
     "net_income": 12241000000000, "total_assets": 295000000000000,
     "total_liabilities": 215000000000000, "total_equity": 80000000000000,
     "debt_ratio": 268.8, "roe": 15.3, "operating_margin": 8.1},
    # 삼성바이오로직스
    {"stock_code": "207940", "fiscal_year": 2024, "report_type": "annual",
     "revenue": 4514000000000, "operating_profit": 1257000000000,
     "net_income": 1098000000000, "total_assets": 22000000000000,
     "total_liabilities": 7000000000000, "total_equity": 15000000000000,
     "debt_ratio": 46.7, "roe": 7.3, "operating_margin": 27.9},
]


def seed():
    print("=== 종목 기본정보 입력 ===")
    for c in COMPANIES:
        existing = (
            supabase_admin.table("stock_companies")
            .select("stock_code")
            .eq("stock_code", c["stock_code"])
            .execute()
        )
        if existing.data:
            supabase_admin.table("stock_companies").update(c).eq("stock_code", c["stock_code"]).execute()
            print(f"  [{c['stock_code']}] {c['stock_name']} - updated")
        else:
            supabase_admin.table("stock_companies").insert(c).execute()
            print(f"  [{c['stock_code']}] {c['stock_name']} - inserted")

    print("\n=== 재무제표 입력 ===")
    for f in FINANCIALS:
        existing = (
            supabase_admin.table("financial_statements")
            .select("id")
            .eq("stock_code", f["stock_code"])
            .eq("fiscal_year", f["fiscal_year"])
            .eq("report_type", f["report_type"])
            .execute()
        )
        label = f"{f['stock_code']} {f['fiscal_year']} {f['report_type']}"
        if existing.data:
            print(f"  [{label}] - skip")
        else:
            supabase_admin.table("financial_statements").insert(f).execute()
            print(f"  [{label}] - done")

    print("\n샘플 데이터 입력 완료!")
    print("실제 전체 종목 수집은 DART API 연동 후 진행 예정.")


if __name__ == "__main__":
    seed()
