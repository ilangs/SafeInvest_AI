# stock_data/explainer/stock_explainer.py

import requests
import os
from dotenv import load_dotenv
from common.db_utils import supabase

load_dotenv()

# Ollama 서버 주소 (로컬 실행 시)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")

def get_stock_data(ticker):
    """DB에서 특정 종목의 최신 데이터를 가져오는 함수"""

    # 1) 기본정보
    stock = supabase.table("stocks") \
        .select("*") \
        .eq("ticker", ticker) \
        .single() \
        .execute()

    # 2) 최신 재무지표 (가장 최근 연간)
    fin = supabase.table("stock_financials") \
        .select("*") \
        .eq("ticker", ticker) \
        .eq("fiscal_quarter", "FY") \
        .order("fiscal_year", desc=True) \
        .limit(3) \
        .execute()

    # 3) 현재 활성 경고
    warnings = supabase.table("stock_warnings") \
        .select("*") \
        .eq("ticker", ticker) \
        .eq("is_active", True) \
        .execute()

    # 4) 최근 30일 가격
    prices = supabase.table("stock_prices") \
        .select("trade_date, close_price, volume, change_rate") \
        .eq("ticker", ticker) \
        .order("trade_date", desc=True) \
        .limit(30) \
        .execute()

    return {
        "stock": stock.data,
        "financials": fin.data,
        "warnings": warnings.data,
        "prices": prices.data
    }

def build_prompt(data):
    """
    데이터를 바탕으로 AI에게 보낼 질문(프롬프트)을 만드는 함수
    """
    stock = data["stock"]
    fins = data["financials"]
    warns = data["warnings"]
    prices = data["prices"]

    prompt = f"""당신은 주식 투자를 처음 시작하는 사람에게 종목을 설명해주는 전문가입니다.
아래 데이터를 보고 이 종목에 대해 한국어로 설명해 주세요.
전문 용어가 나오면 괄호 안에 뜻을 함께 적어 주세요.
위험 요소가 있으면 반드시 강조해서 알려 주세요.

## 종목 기본정보
- 종목명: {stock['stock_name']}
- 종목코드: {stock['ticker']}
- 시장: {stock['market']}
- 업종: {stock.get('sector', '정보 없음')}
- 주요 사업: {stock.get('industry', '정보 없음')}
"""

    if fins:
        prompt += "\n## 재무 지표 (최근 연간)\n"
        for f in fins:
            prompt += f"""
### {f['fiscal_year']}년
- 매출액: {f.get('revenue', 'N/A')}원
- 영업이익: {f.get('operating_profit', 'N/A')}원
- 당기순이익: {f.get('net_income', 'N/A')}원
- ROE(자기자본이익률): {f.get('roe', 'N/A')}%
- 부채비율: {f.get('debt_ratio', 'N/A')}%
- PER(주가수익비율): {f.get('per', 'N/A')}
- PBR(주가순자산비율): {f.get('pbr', 'N/A')}
- 자본잠식 여부: {'예 ⚠️' if f.get('capital_impairment') else '아니오'}
"""

    if warns:
        prompt += "\n## ⚠️ 현재 활성 경고\n"
        for w in warns:
            prompt += f"- {w['warning_type']}: {w.get('reason', '사유 미상')} ({w['designated_date']})\n"

    if prices and len(prices) > 0:
        latest = prices[0]
        prompt += f"""
## 최근 시세
- 최근 종가: {latest.get('close_price', 'N/A')}원
- 최근 거래량: {latest.get('volume', 'N/A')}주
- 최근 등락률: {latest.get('change_rate', 'N/A')}%
- 조회 기간: 최근 {len(prices)}거래일
"""
    prompt += """
위 데이터를 종합하여 다음을 설명해 주세요:
1. 이 회사는 어떤 회사인지 (업종, 사업)
2. 돈을 잘 벌고 있는지 (수익성 추이)
3. 재무 상태가 안전한지 (부채, 자본잠식)
4. 현재 주가 수준이 어떤지 (PER, PBR 기반)
5. 주의해야 할 위험 요소 (있다면)
6. 종합 의견 (한 줄 요약)
"""
    return prompt

def explain_stock_ollama(ticker):
    """Ollama를 사용하여 종목 설명 생성"""
    data = get_stock_data(ticker)
    prompt = build_prompt(data)

    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 1024
            }
        },
        timeout=120
    )

    if response.status_code == 200:
        return response.json()["response"]
    else:
        return f"[오류] Ollama 응답 실패: {response.status_code}"

def explain_stock_openai(ticker):
    """
    배포 시 사용: OpenAI API로 전환
    개발 중에는 Ollama, 배포 후에는 이 함수 사용
    """
    import openai
    openai.api_key = os.getenv("OPENAI_API_KEY")

    data = get_stock_data(ticker)
    prompt = build_prompt(data)

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system",
             "content": "당신은 주식 투자를 처음 시작하는 사람에게 종목을 설명해주는 전문가입니다."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
        max_tokens=1024
    )

    return response.choices[0].message.content

def explain_stock(ticker):
    """
    환경변수에 따라 Ollama 또는 OpenAI 자동 선택

    .env 에 USE_OLLAMA=true 이면 Ollama 사용
    .env 에 USE_OLLAMA=false 이면 OpenAI 사용
    """
    use_ollama = os.getenv("USE_OLLAMA", "true").lower() == "true"

    if use_ollama:
        return explain_stock_ollama(ticker)
    else:
        return explain_stock_openai(ticker)

# 사용 예시
if __name__ == "__main__":
    result = explain_stock("005930")
    print(result)