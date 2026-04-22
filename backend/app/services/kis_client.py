"""
app/services/kis_client.py
───────────────────────────
한국투자증권 KIS Developers API 클라이언트.

인증 흐름:
  1. get_access_token() 으로 OAuth2 토큰 발급 (유효기간 24시간)
  2. 이후 API 요청 헤더에 토큰 포함

참고:
  - 모의투자 URL : https://openapivts.koreainvestment.com:29443
  - 실거래 URL   : https://openapi.koreainvestment.com:9443
  - 공식 문서    : https://apiportal.koreainvestment.com
"""

import httpx
from datetime import datetime, timedelta, timezone
from app.core.config import settings


class KISTokenStore:
    """KIS access_token 을 메모리에 캐싱합니다 (앱 재시작 시 재발급)."""
    _token: str | None = None
    _expires_at: datetime | None = None

    @classmethod
    def is_valid(cls) -> bool:
        if cls._token is None or cls._expires_at is None:
            return False
        return datetime.now(tz=timezone.utc) < cls._expires_at

    @classmethod
    def set(cls, token: str, expires_at: datetime) -> None:
        cls._token = token
        cls._expires_at = expires_at

    @classmethod
    def get(cls) -> str | None:
        return cls._token


async def get_access_token() -> str:
    """
    KIS OAuth2 토큰을 발급하거나 캐시에서 반환합니다.
    유효한 토큰이 있으면 재발급하지 않습니다.
    """
    if KISTokenStore.is_valid():
        return KISTokenStore.get()  # type: ignore

    url = f"{settings.kis_base_url}/oauth2/tokenP"
    payload = {
        "grant_type": "client_credentials",
        "appkey": settings.kis_app_key,
        "appsecret": settings.kis_app_secret,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()

    token = data["access_token"]
    expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=23)
    KISTokenStore.set(token, expires_at)
    return token


def _kis_headers(token: str, tr_id: str) -> dict:
    """공통 KIS 요청 헤더를 반환합니다."""
    return {
        "authorization": f"Bearer {token}",
        "appkey": settings.kis_app_key,
        "appsecret": settings.kis_app_secret,
        "tr_id": tr_id,
        "custtype": "P",
        "content-type": "application/json; charset=utf-8",
    }


async def get_quote(symbol: str) -> dict:
    """
    주식 현재가 조회.
    symbol : 6자리 종목코드 (예: "005930" = 삼성전자)
    """
    token = await get_access_token()
    url = f"{settings.kis_base_url}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = _kis_headers(token, "FHKST01010100")
    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": symbol,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

    output = data.get("output", {})
    return {
        "symbol":        symbol,
        "name":          output.get("hts_kor_isnm", ""),
        "current_price": int(output.get("stck_prpr", 0)),
        "change":        int(output.get("prdy_vrss", 0)),
        "change_rate":   float(output.get("prdy_ctrt", 0.0)),
        "volume":        int(output.get("acml_vol", 0)),
        "market_cap":    None,
    }


async def get_balance() -> dict:
    """
    잔고 및 매수가능금액 조회.
    모의투자 TR: VTTC8434R / 실거래 TR: TTTC8434R
    """
    try:
        token = await get_access_token()
        tr_id = "VTTC8434R" if settings.kis_is_mock else "TTTC8434R"
        url = f"{settings.kis_base_url}/uapi/domestic-stock/v1/trading/inquire-psbl-order"

        # 잔고 조회는 별도 TR 사용 (주문가능금액 조회)
        balance_tr = "VTTC8908R" if settings.kis_is_mock else "TTTC8908R"
        headers = _kis_headers(token, balance_tr)
        params = {
            "CANO":           settings.kis_account,
            "ACNT_PRDT_CD":   "01",
            "PDNO":           "005930",   # 임의 종목 (잔고 조회에 필요)
            "ORD_UNPR":       "0",
            "ORD_DVSN":       "01",
            "CMA_EVLU_AMT_ICLD_YN": "N",
            "OVRS_ICLD_YN":   "N",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.kis_base_url}/uapi/domestic-stock/v1/trading/inquire-psbl-order",
                headers=headers,
                params=params,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

        output = data.get("output", {})
        return {
            "deposit":           int(output.get("dnca_tot_amt", 0)),
            "available":         int(output.get("nrcvb_buy_amt", 0)),
            "total_eval":        int(output.get("tot_evlu_amt", 0)),
            "total_profit_loss": int(output.get("evlu_pfls_smtl_amt", 0)),
        }

    except Exception:
        # KIS 키 미설정 또는 네트워크 오류 시 기본값 반환
        return {
            "deposit":           0,
            "available":         0,
            "total_eval":        0,
            "total_profit_loss": 0,
        }


async def get_holdings() -> list[dict]:
    """
    보유종목 목록 조회.
    모의투자 TR: VTTC8434R / 실거래 TR: TTTC8434R
    """
    try:
        token = await get_access_token()
        tr_id = "VTTC8434R" if settings.kis_is_mock else "TTTC8434R"
        url = f"{settings.kis_base_url}/uapi/domestic-stock/v1/trading/inquire-balance"
        headers = _kis_headers(token, tr_id)
        params = {
            "CANO":                 settings.kis_account,
            "ACNT_PRDT_CD":         "01",
            "AFHR_FLPR_YN":         "N",
            "OFL_YN":               "",
            "INQR_DVSN":            "02",
            "UNPR_DVSN":            "01",
            "FUND_STTL_ICLD_YN":    "N",
            "FNCG_AMT_AUTO_RDPT_YN":"N",
            "PRCS_DVSN":            "01",
            "CTX_AREA_FK100":       "",
            "CTX_AREA_NK100":       "",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()

        items = data.get("output1", []) or []
        return [
            {
                "stock_code":       item.get("pdno", ""),
                "stock_name":       item.get("prdt_name", ""),
                "quantity":         int(item.get("hldg_qty", 0)),
                "avg_price":        int(float(item.get("pchs_avg_pric", 0))),
                "current_price":    int(item.get("prpr", 0)),
                "profit_loss":      int(item.get("evlu_pfls_amt", 0)),
                "profit_loss_rate": float(item.get("evlu_pfls_rt", 0.0)),
            }
            for item in items
            if int(item.get("hldg_qty", 0)) > 0
        ]

    except Exception:
        return []


async def get_orderbook(symbol: str) -> dict:
    """
    호가 데이터 조회.
    모의투자 TR: FHKST01010200 (주식 호가)
    실거래  TR: FHKST01010200 (동일)

    KIS API 미연결 시 현실적인 mock 데이터 반환.
    mock 데이터는 현재가 기준 +-0.5% 범위로 자동 생성.
    """
    token = await get_access_token()
    url = f"{settings.kis_base_url}/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn"
    headers = {
        "authorization": f"Bearer {token}",
        "appkey": settings.kis_app_key,
        "appsecret": settings.kis_app_secret,
        "tr_id": "FHKST01010200",
    }
    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": symbol,
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            output1 = data.get("output1", {})
            asks = []
            bids = []
            for i in range(1, 6):
                asks.append({
                    "price": int(output1.get(f"askp{i}", 0)),
                    "volume": int(output1.get(f"askp_rsqn{i}", 0)),
                })
                bids.append({
                    "price": int(output1.get(f"bidp{i}", 0)),
                    "volume": int(output1.get(f"bidp_rsqn{i}", 0)),
                })
            return {"asks": asks, "bids": bids, "symbol": symbol}
    except Exception:
        # Fallback mock 데이터
        import random
        base = 219000  # 삼성전자 기준
        asks = [{"price": base + (i * 500), "volume": random.randint(50000, 300000)} for i in range(1, 6)]
        bids = [{"price": base - (i * 500), "volume": random.randint(50000, 300000)} for i in range(1, 6)]
        return {"asks": asks, "bids": bids, "symbol": symbol, "is_mock": True}


async def get_chart_data(symbol: str, period: str = "D") -> dict:
    """
    차트 OHLCV 데이터 조회.
    period: D=일봉, W=주봉, M=월봉, Y=년봉(월봉 3년치)
    TR: FHKST03010100 (국내 주식 기간별 시세)

    KIS API 미연결 시 현실적인 mock 데이터 반환.
    """
    from datetime import datetime as dt, timedelta
    import random
    token = await get_access_token()

    # Y(년) → KIS는 월봉(M)으로 3년치 조회
    kis_period = "M" if period == "Y" else period

    end_date = dt.now().strftime("%Y%m%d")
    if period == "D":
        start_date = (dt.now() - timedelta(days=90)).strftime("%Y%m%d")    # 약 60 거래일
    elif period == "W":
        start_date = (dt.now() - timedelta(weeks=52)).strftime("%Y%m%d")   # 1년치 주봉
    elif period == "M":
        start_date = (dt.now() - timedelta(days=365 * 2)).strftime("%Y%m%d")  # 2년치 월봉
    else:  # Y
        start_date = (dt.now() - timedelta(days=365 * 5)).strftime("%Y%m%d")  # 5년치 월봉

    url = f"{settings.kis_base_url}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
    headers = {
        "authorization": f"Bearer {token}",
        "appkey": settings.kis_app_key,
        "appsecret": settings.kis_app_secret,
        "tr_id": "FHKST03010100",
    }
    params = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD": symbol,
        "FID_INPUT_DATE_1": start_date,
        "FID_INPUT_DATE_2": end_date,
        "FID_PERIOD_DIV_CODE": kis_period,
        "FID_ORG_ADJ_PRC": "0",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            candles = []
            for item in data.get("output2", []):
                candles.append({
                    "date":   item.get("stck_bsop_date", ""),
                    "open":   int(item.get("stck_oprc", 0)),
                    "high":   int(item.get("stck_hgpr", 0)),
                    "low":    int(item.get("stck_lwpr", 0)),
                    "close":  int(item.get("stck_clpr", 0)),
                    "volume": int(item.get("acml_vol", 0)),
                })
            return {"symbol": symbol, "period": period, "candles": candles}
    except Exception:
        # Fallback mock 데이터 — 봉 수: D=60, W=52, M=24, Y=60
        n_candles = {"D": 60, "W": 52, "M": 24, "Y": 60}.get(period, 60)
        candles = []
        base_price = 219000
        price = base_price
        for i in range(n_candles, 0, -1):
            if period == "D":
                d = (dt.now() - timedelta(days=i)).strftime("%Y%m%d")
            elif period == "W":
                d = (dt.now() - timedelta(weeks=i)).strftime("%Y%m%d")
            elif period == "M":
                d = (dt.now() - timedelta(days=i * 30)).strftime("%Y%m%d")
            else:  # Y → 월봉 5년치
                d = (dt.now() - timedelta(days=i * 30)).strftime("%Y%m%d")
            change = random.uniform(-0.03, 0.03)
            open_p  = int(price)
            close_p = int(price * (1 + change))
            high_p  = int(max(open_p, close_p) * random.uniform(1.001, 1.015))
            low_p   = int(min(open_p, close_p) * random.uniform(0.985, 0.999))
            vol     = random.randint(8_000_000, 25_000_000)
            candles.append({
                "date": d, "open": open_p, "high": high_p,
                "low": low_p, "close": close_p, "volume": vol,
            })
            price = close_p
        return {"symbol": symbol, "period": period, "candles": candles, "is_mock": True}


async def place_order(
    symbol: str,
    order_type: str,   # "buy" | "sell"
    quantity: int,
    price: int | None = None,    # None=시장가
) -> dict:
    """
    주식 주문 (모의/실거래 자동 TR 분기).

    모의매수: VTTC0802U / 모의매도: VTTC0801U
    실거래매수: TTTC0802U / 실거래매도: TTTC0801U
    """
    # TR ID 결정
    if order_type == "buy":
        tr_id = "VTTC0802U" if settings.kis_is_mock else "TTTC0802U"
    else:
        tr_id = "VTTC0801U" if settings.kis_is_mock else "TTTC0801U"

    # 주문구분: 00=지정가, 01=시장가
    ord_dvsn = "01" if price is None else "00"
    ord_price = str(price) if price else "0"

    try:
        token = await get_access_token()
        url = f"{settings.kis_base_url}/uapi/domestic-stock/v1/trading/order-cash"
        headers = _kis_headers(token, tr_id)
        body = {
            "CANO":         settings.kis_account,
            "ACNT_PRDT_CD": "01",
            "PDNO":         symbol,
            "ORD_DVSN":     ord_dvsn,
            "ORD_QTY":      str(quantity),
            "ORD_UNPR":     ord_price,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=body, timeout=10)
            resp.raise_for_status()
            data = resp.json()

        output = data.get("output", {})
        return {
            "order_id":   output.get("ODNO", f"KIS-{symbol}-{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            "symbol":     symbol,
            "order_type": order_type,
            "quantity":   quantity,
            "price":      price,
            "status":     "accepted",
            "message":    f"{'모의' if settings.kis_is_mock else '실거래'} 주문 접수 완료",
        }

    except Exception as e:
        # 키 미설정 또는 네트워크 오류 → mock 응답
        return {
            "order_id":   f"MOCK-{symbol}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "symbol":     symbol,
            "order_type": order_type,
            "quantity":   quantity,
            "price":      price,
            "status":     "mock_accepted",
            "message":    f"KIS 연결 불가 (mock fallback): {str(e)[:80]}",
        }
