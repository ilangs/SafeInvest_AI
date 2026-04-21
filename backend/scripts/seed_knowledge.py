"""
scripts/seed_knowledge.py
──────────────────────────
SafeInvest AI 지식 데이터 10건을 Supabase에 삽입하고 임베딩을 생성합니다.

실행:
  cd backend
  python scripts/seed_knowledge.py

동작:
  1. knowledge_chunks 에 title 중복 체크 후 INSERT
  2. OpenAI text-embedding-3-small 으로 임베딩 생성
  3. knowledge_embeddings 에 벡터 저장
"""

import sys
import os

# backend/ 를 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from openai import OpenAI
from app.core.config import settings
from app.core.supabase import supabase_admin

openai_client = OpenAI(api_key=settings.openai_api_key)

KNOWLEDGE_DATA = [
    {
        "category": "D",
        "title": "분산투자란 무엇인가",
        "content": (
            "분산투자란 투자 위험을 줄이기 위해 여러 자산이나 종목에 나눠서 투자하는 방법입니다. "
            "'계란을 한 바구니에 담지 말라'는 격언이 분산투자의 핵심을 잘 표현합니다. "
            "한 종목에 모든 자금을 투자하면 그 기업이 어려워졌을 때 큰 손실이 발생합니다. "
            "반면 여러 종목, 여러 업종에 나눠 투자하면 한 종목이 하락해도 "
            "다른 종목이 이를 어느 정도 상쇄해줄 수 있습니다. "
            "초보 투자자는 한 종목에 전체 자금의 20% 이상을 투자하지 않는 것을 권장합니다. "
            "ETF(상장지수펀드)는 하나의 상품으로 분산투자 효과를 얻을 수 있는 좋은 수단입니다."
        ),
        "source": "금융감독원 금융교육포털",
        "source_url": "https://www.fss.or.kr/edu/main/main.do",
        "tags": ["분산투자", "리스크관리", "기초", "D-01"],
        "metadata": {"category": "D", "topic": "분산투자"},
    },
    {
        "category": "A",
        "title": "PER(주가수익비율)이란 무엇인가",
        "content": (
            "PER(Price Earnings Ratio, 주가수익비율)은 주가를 주당순이익(EPS)으로 나눈 값입니다. "
            "예를 들어 주가가 10만원이고 주당순이익이 1만원이면 PER은 10배입니다. "
            "PER이 낮을수록 이익 대비 주가가 저렴하다는 의미이지만, "
            "업종마다 적정 PER이 다르므로 반드시 같은 업종 내에서 비교해야 합니다. "
            "성장주는 미래 기대감으로 PER이 높게 형성되는 경우가 많고, "
            "가치주는 상대적으로 낮은 PER을 보이는 경향이 있습니다. "
            "PER 하나만으로 투자 결정을 내리는 것은 위험하며, PBR, ROE 등과 함께 종합 판단해야 합니다."
        ),
        "source": "금융감독원 금융용어사전",
        "source_url": "https://terms.naver.com/entry.naver?docId=1599&cid=42095&categoryId=42095",
        "tags": ["PER", "재무지표", "주가평가", "A-01"],
        "metadata": {"category": "A", "topic": "PER"},
    },
    {
        "category": "D",
        "title": "왜 몰빵(집중) 투자는 위험한가",
        "content": (
            "몰빵 투자란 보유 자금 전부 또는 대부분을 하나의 종목에 투자하는 방식입니다. "
            "한 종목이 크게 오르면 높은 수익을 기대할 수 있지만, "
            "그 기업에 악재가 발생하면 전 재산을 잃을 수 있는 치명적인 위험이 있습니다. "
            "실제로 회계부정, 경영진 비리, 산업 변화 등으로 주가가 90% 이상 하락한 사례가 적지 않습니다. "
            "전문 투자자들도 개별 종목 비중을 포트폴리오의 5~10% 이내로 제한하는 경우가 많습니다. "
            "투자의 목표는 크게 버는 것보다 잃지 않는 것에서 시작해야 합니다."
        ),
        "source": "금융소비자보호재단",
        "source_url": "http://www.kfcpf.or.kr",
        "tags": ["몰빵투자", "위험", "분산투자", "D-10"],
        "metadata": {"category": "D", "topic": "집중투자위험"},
    },
    {
        "category": "C",
        "title": "코스피와 코스닥의 차이",
        "content": (
            "코스피(KOSPI)는 한국거래소(KRX)에 상장된 대형 기업들의 주가지수입니다. "
            "삼성전자, SK하이닉스, 현대차 같은 대기업이 주로 상장되어 있습니다. "
            "코스닥(KOSDAQ)은 중소·벤처기업 중심의 시장으로, "
            "성장 가능성이 있는 기술·바이오 기업들이 많이 상장되어 있습니다. "
            "코스닥은 코스피에 비해 상장 요건이 낮고 기업 규모가 작아 "
            "변동성이 크고 위험도가 높은 편입니다. "
            "초보 투자자는 코스닥 소형주보다 코스피 대형주나 ETF로 시작하는 것을 권장합니다."
        ),
        "source": "한국거래소(KRX)",
        "source_url": "https://www.krx.co.kr",
        "tags": ["코스피", "코스닥", "시장구조", "C-01"],
        "metadata": {"category": "C", "topic": "시장구조"},
    },
    {
        "category": "A",
        "title": "배당수익률이란 무엇인가",
        "content": (
            "배당수익률은 주가 대비 연간 배당금의 비율입니다. "
            "예를 들어 주가 10만원인 기업이 연간 3,000원의 배당을 지급하면 배당수익률은 3%입니다. "
            "배당주 투자는 주가 상승이 크지 않아도 꾸준한 현금 수입을 얻을 수 있어 "
            "장기 투자자에게 적합한 전략입니다. "
            "다만 배당수익률이 높다고 무조건 좋은 것은 아닙니다. "
            "주가가 크게 하락하면 배당수익률이 높아 보이지만 기업의 펀더멘털에 문제가 있을 수 있습니다. "
            "배당 지속성(몇 년간 꾸준히 배당했는지)도 함께 확인해야 합니다."
        ),
        "source": "금융감독원 금융교육포털",
        "source_url": "https://www.fss.or.kr/edu/main/main.do",
        "tags": ["배당", "배당수익률", "장기투자", "A-07"],
        "metadata": {"category": "A", "topic": "배당"},
    },
    {
        "category": "B",
        "title": "ETF란 무엇인가",
        "content": (
            "ETF(Exchange Traded Fund, 상장지수펀드)는 특정 지수나 자산을 추종하도록 설계된 "
            "펀드를 주식처럼 거래소에서 사고 팔 수 있는 상품입니다. "
            "예를 들어 KODEX 200은 코스피200 지수를 추종하며, "
            "이 ETF 하나를 사면 코스피200을 구성하는 200개 기업에 분산투자하는 효과를 얻습니다. "
            "ETF의 장점은 낮은 비용, 높은 분산효과, 실시간 매매 가능입니다. "
            "초보 투자자에게 개별 종목보다 시장 전체에 투자하는 ETF가 "
            "더 안전한 첫 번째 투자 수단으로 권장됩니다."
        ),
        "source": "한국거래소 ETF 안내",
        "source_url": "https://www.krx.co.kr/main/listing/ETF/MDCSTAT00301.jsp",
        "tags": ["ETF", "분산투자", "기초", "인덱스펀드"],
        "metadata": {"category": "B", "topic": "ETF"},
    },
    {
        "category": "D",
        "title": "주식 거래 시간과 기본 주문 유형",
        "content": (
            "국내 주식시장의 정규 거래 시간은 오전 9시부터 오후 3시 30분까지입니다. "
            "장 시작 전(8:30~9:00)과 장 마감 후(15:30~16:00)에는 시간외 거래가 가능합니다. "
            "주문 유형은 크게 두 가지입니다. "
            "시장가 주문: 현재 시장 가격으로 즉시 체결. 빠르지만 원하는 가격을 보장받지 못합니다. "
            "지정가 주문: 원하는 가격을 직접 입력. 해당 가격에 도달해야 체결됩니다. "
            "초보자는 급하게 사고파는 것보다 지정가 주문으로 원하는 가격을 설정하는 방식을 권장합니다. "
            "결제는 주문 후 2영업일(T+2)에 완료됩니다."
        ),
        "source": "한국거래소(KRX)",
        "source_url": "https://www.krx.co.kr",
        "tags": ["거래시간", "주문유형", "시장가", "지정가", "기초"],
        "metadata": {"category": "D", "topic": "거래방법"},
    },
    {
        "category": "D",
        "title": "손절매의 원칙과 중요성",
        "content": (
            "손절매란 매수한 주식이 일정 수준 이상 하락했을 때 손실을 확정하고 팔아버리는 것을 말합니다. "
            "처음엔 손실을 인정하기 싫어 버티는 경우가 많지만, "
            "이는 더 큰 손실로 이어지는 경우가 많습니다. "
            "일반적으로 매수가 대비 7~10% 하락 시 손절을 고려하는 원칙을 세워두는 것이 좋습니다. "
            "손절매는 실패가 아니라 리스크 관리의 일부입니다. "
            "감정이 아닌 미리 정한 원칙에 따라 기계적으로 실행하는 것이 중요합니다. "
            "잃지 않는 투자가 결국 오래 투자할 수 있는 기반이 됩니다."
        ),
        "source": "금융소비자보호재단",
        "source_url": "http://www.kfcpf.or.kr",
        "tags": ["손절매", "리스크관리", "원칙", "D-06"],
        "metadata": {"category": "D", "topic": "손절매"},
    },
    {
        "category": "E",
        "title": "관리종목·상장폐지 위험이란 무엇인가",
        "content": (
            "관리종목은 한국거래소가 상장 유지 요건을 충족하지 못한 기업에 지정하는 제도입니다. "
            "주요 지정 사유로는 자본잠식(부채가 자산보다 많아진 상태), "
            "4년 연속 영업손실, 감사의견 비적정, 거래량 미달 등이 있습니다. "
            "관리종목 지정 후에도 문제가 해결되지 않으면 상장폐지가 될 수 있습니다. "
            "상장폐지가 되면 주식 거래가 불가능해지고 투자금을 대부분 잃을 수 있습니다. "
            "종목 매수 전 반드시 관리종목 여부, 자본잠식 여부를 확인하는 습관을 들이세요. "
            "이 정보는 HTS·MTS의 기업 개요, 또는 금융감독원 DART에서 확인할 수 있습니다."
        ),
        "source": "금융감독원 DART",
        "source_url": "https://dart.fss.or.kr",
        "tags": ["관리종목", "상장폐지", "위험신호", "자본잠식"],
        "metadata": {"category": "E", "topic": "관리종목"},
    },
    {
        "category": "D",
        "title": "주식 양도소득세와 ISA 계좌 기초",
        "content": (
            "국내 주식 투자 시 세금을 이해하는 것도 중요합니다. "
            "국내 주식의 매매차익(양도소득)은 대주주가 아닌 경우 현재 비과세입니다. "
            "다만 배당소득은 15.4% 세율로 원천징수됩니다. "
            "ISA(Individual Savings Account, 개인종합자산관리계좌)는 "
            "다양한 금융상품을 하나의 계좌에서 운용하며 세제 혜택을 받을 수 있는 계좌입니다. "
            "일반형은 200만원, 서민·농어민형은 400만원까지 비과세 혜택이 있습니다. "
            "장기 투자를 계획하고 있다면 ISA 계좌 활용을 적극 검토해보세요. "
            "세금 제도는 매년 변경될 수 있으므로 국세청 홈택스에서 최신 내용을 확인하세요."
        ),
        "source": "국세청 홈택스",
        "source_url": "https://www.hometax.go.kr",
        "tags": ["세금", "양도소득세", "ISA", "절세"],
        "metadata": {"category": "D", "topic": "세금"},
    },
]


def embed(text: str) -> list[float]:
    """OpenAI text-embedding-3-small 으로 임베딩을 생성합니다."""
    resp = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return resp.data[0].embedding


def existing_titles() -> set[str]:
    """이미 저장된 knowledge_chunks 의 title 집합을 반환합니다."""
    resp = supabase_admin.table("knowledge_chunks").select("title").execute()
    return {row["title"] for row in (resp.data or [])}


def main():
    total = len(KNOWLEDGE_DATA)
    print(f"\n[START] SafeInvest 지식 데이터 시드 시작 -- 총 {total}건\n")

    already = existing_titles()
    if already:
        print(f"  [INFO] 이미 저장된 항목 {len(already)}건은 건너뜁니다.\n")

    saved = 0
    skipped = 0

    for idx, item in enumerate(KNOWLEDGE_DATA, start=1):
        title = item["title"]

        if title in already:
            print(f"  [SKIP] [{idx}/{total}] {title} -- 이미 존재, 건너뜀")
            skipped += 1
            continue

        try:
            # 1. knowledge_chunks INSERT
            chunk_resp = supabase_admin.table("knowledge_chunks").insert({
                "category":  item["category"],
                "title":     title,
                "content":   item["content"],
                "source":    item["source"],
                "source_url": item["source_url"],
                "tags":      item["tags"],
                "metadata":  item["metadata"],
            }).execute()

            chunk_id = chunk_resp.data[0]["id"]

            # 2. 임베딩 생성
            vector = embed(item["content"])

            # 3. knowledge_embeddings INSERT
            supabase_admin.table("knowledge_embeddings").insert({
                "chunk_id":  chunk_id,
                "embedding": vector,
            }).execute()

            print(f"  [OK]   [{idx}/{total}] {title} -- 저장 완료 (chunk_id: {chunk_id[:8]}...)")
            saved += 1

        except Exception as e:
            print(f"  [FAIL] [{idx}/{total}] {title} -- 오류: {e}")

    print(f"\n[DONE] 완료 -- 저장: {saved}건 / 건너뜀: {skipped}건 / 실패: {total - saved - skipped}건\n")


if __name__ == "__main__":
    main()
