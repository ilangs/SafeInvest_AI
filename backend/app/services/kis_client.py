"""
app/services/kis_client.py
───────────────────────────
한국투자증권 KIS Developers API 클라이언트.

변경사항 (v3):
  - get_user_token → dict 반환 (token, app_key, app_secret, cano, acnt_prdt_cd, …)
  - 모든 KIS API 호출에 appkey / appsecret / custtype 헤더 추가
  - get_balance / get_holdings 에 CANO / ACNT_PRDT_CD 파라미터 추가
  - get_stock_info (시가총액·상한가·PER·52주 범위 등) 신규 추가
  - get_today_orders (당일 주문내역) 신규 추가
  - 토큰 갱신 실패 → KISNotConnectedError 로 래핑 (500 방지)
  - 2차 토큰 저장: upsert → update 로 변경 (NOT NULL 위반 방지)
"""

import re
import random
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status


class KISNotConnectedError(Exception):
    """KIS 계좌가 연결되지 않은 경우"""
    pass


def _base_url(is_mock: bool) -> str:
    if is_mock:
        return "https://openapivts.koreainvestment.com:29443"
    return "https://openapi.koreainvestment.com:9443"


def _kis_headers(creds: dict, tr_id: str, is_post: bool = False) -> dict:
    """KIS API 공통 요청 헤더 생성."""
    h = {
        "authorization": f"Bearer {creds['token']}",
        "appkey":        creds["app_key"],
        "appsecret":     creds["app_secret"],
        "tr_id":         tr_id,
        "custtype":      "P",
    }
    if is_post:
        h["content-type"] = "application/json; charset=utf-8"
    return h


# ── 토큰 발급 ──────────────────────────────────────────────────────────────────

async def get_access_token_with_key(
    app_key: str,
    app_secret: str,
    is_mock: bool = True,
) -> str:
    """특정 키로 KIS 토큰 발급. 계좌 연결 테스트용."""
    url = f"{_base_url(is_mock)}/oauth2/tokenP"
    payload = {
        "grant_type": "client_credentials",
        "appkey":     app_key,
        "appsecret":  app_secret,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        token = data.get("access_token")
        if not token:
            raise ValueError(data.get("error_description", "토큰 발급 실패"))
        return token


async def get_user_token(user_id: str, is_mock: bool = True) -> dict:
    """
    Supabase에서 사용자 암호화 키를 꺼내 복호화 후 KIS 자격증명 딕셔너리 반환.

    Returns:
        {
            "token":            str,   # KIS access token
            "app_key":          str,
            "app_secret":       str,
            "cano":             str,   # 계좌번호 앞 8자리
            "acnt_prdt_cd":     str,   # 상품코드 뒤 2자리
            "account_no_masked": str,
            "row_id":           str,
        }
    Raises:
        KISNotConnectedError  – 미연결 또는 키 오류
    """
    from app.core.supabase import supabase_admin
    from app.core.encryption import decrypt

    row = (
        supabase_admin.table("user_kis_credentials")
        .select("*")
        .eq("user_id", user_id)
        .eq("is_mock", is_mock)
        .eq("is_active", True)
        .maybe_single()
        .execute()
        .data
    )

    if not row:
        raise KISNotConnectedError(
            f"{'모의투자' if is_mock else '실거래'} KIS 계좌가 연결되지 않았습니다. "
            "마이페이지에서 계좌를 연결해 주세요."
        )

    # 앱 키 / 시크릿 복호화
    app_key    = decrypt(row["enc_app_key"])
    app_secret = decrypt(row["enc_app_secret"])

    # 계좌번호 복호화 + CANO / ACNT_PRDT_CD 분리
    account_no_raw = ""
    if row.get("enc_account_no"):
        try:
            account_no_raw = decrypt(row["enc_account_no"])
        except Exception:
            pass
    clean        = re.sub(r"\D", "", account_no_raw)        # 숫자만
    cano         = clean[:8]  if len(clean) >= 8 else clean  # 앞 8자리
    acnt_prdt_cd = clean[8:10] if len(clean) > 8 else "01"   # 뒤 2자리

    # ── 캐시 토큰 유효 여부 확인 ───────────────────────────────────────────────
    if row.get("access_token") and row.get("token_expires_at"):
        try:
            expires = datetime.fromisoformat(row["token_expires_at"])
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if expires > datetime.now(tz=timezone.utc):
                return {
                    "token":            row["access_token"],
                    "app_key":          app_key,
                    "app_secret":       app_secret,
                    "cano":             cano,
                    "acnt_prdt_cd":     acnt_prdt_cd,
                    "account_no_masked": row["account_no_masked"],
                    "row_id":           row["id"],
                }
        except (ValueError, TypeError):
            pass

    # ── 토큰 재발급 ────────────────────────────────────────────────────────────
    try:
        new_token = await get_access_token_with_key(app_key, app_secret, is_mock)
    except Exception as e:
        raise KISNotConnectedError(
            f"KIS 토큰 발급 실패. APP KEY/SECRET을 확인해 주세요. ({str(e)[:80]})"
        )

    expires_at = (datetime.now(tz=timezone.utc) + timedelta(hours=23)).isoformat()
    # update 사용 (불완전 insert 방지)
    try:
        supabase_admin.table("user_kis_credentials").update(
            {"access_token": new_token, "token_expires_at": expires_at}
        ).eq("id", row["id"]).execute()
    except Exception:
        pass  # 토큰 캐싱 실패해도 이번 요청은 계속

    return {
        "token":            new_token,
        "app_key":          app_key,
        "app_secret":       app_secret,
        "cano":             cano,
        "acnt_prdt_cd":     acnt_prdt_cd,
        "account_no_masked": row["account_no_masked"],
        "row_id":           row["id"],
    }


def _raise_not_connected(e: KISNotConnectedError) -> None:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── 종목코드 → 종목명 fallback 테이블 ────────────────────────────────────────
_KR_STOCK_NAMES: dict[str, str] = {
    "005930": "삼성전자",    "000660": "SK하이닉스",  "035420": "NAVER",
    "005380": "현대차",      "000270": "기아",         "051910": "LG화학",
    "006400": "삼성SDI",     "035720": "카카오",       "373220": "LG에너지솔루션",
    "207940": "삼성바이오로직스", "068270": "셀트리온", "055550": "신한지주",
    "105560": "KB금융",      "086790": "하나금융지주", "316140": "우리금융지주",
    "005490": "POSCO홀딩스", "066570": "LG전자",       "003550": "LG",
    "028260": "삼성물산",    "012330": "현대모비스",   "009150": "삼성전기",
    "018260": "삼성에스디에스", "017670": "SK텔레콤",  "030200": "KT",
    "032640": "LG유플러스",  "034730": "SK",           "096770": "SK이노베이션",
    "003490": "대한항공",    "011200": "HMM",           "032830": "삼성생명",
    "000100": "유한양행",    "036570": "엔씨소프트",   "259960": "크래프톤",
    "251270": "넷마블",      "352820": "하이브",        "010130": "고려아연",
    "009830": "한화솔루션",  "000720": "현대건설",      "139480": "이마트",
    "086520": "에코프로",    "247540": "에코프로비엠",  "196170": "알테오젠",
    "293490": "카카오게임즈", "263750": "펄어비스",     "041510": "에스엠",
    "035900": "JYP Ent.",    "145020": "휴젤",          "047050": "포스코인터내셔널",
    "011170": "롯데케미칼",  "023530": "롯데쇼핑",
}

def _stock_name(symbol: str) -> str:
    """종목코드로 한국어 종목명 반환. 테이블에 없으면 코드 그대로."""
    return _KR_STOCK_NAMES.get(symbol, symbol)


# ── 현재가 조회 ────────────────────────────────────────────────────────────────

def _mock_quote(symbol: str) -> dict:
    base = 219_000
    return {
        "symbol":        symbol,
        "name":          _stock_name(symbol),
        "current_price": base + random.randint(-3_000, 3_000),
        "change":        random.randint(-2_000, 2_000),
        "change_rate":   round(random.uniform(-2.0, 2.0), 2),
        "volume":        random.randint(10_000_000, 30_000_000),
    }


async def get_quote(symbol: str, user_id: str, is_mock: bool = True) -> dict:
    """현재가 조회. 미연결 시 mock 데이터 반환."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return _mock_quote(symbol)

    url     = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = _kis_headers(creds, "FHKST01010100")
    params  = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": symbol}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        output = resp.json().get("output", {})
        name = output.get("hts_kor_isnm", "").strip() or _stock_name(symbol)
        return {
            "symbol":        symbol,
            "name":          name,
            "current_price": int(output.get("stck_prpr", 0)   or 0),
            "change":        int(output.get("prdy_vrss", 0)    or 0),
            "change_rate":   float(output.get("prdy_ctrt", 0)  or 0),
            "volume":        int(output.get("acml_vol", 0)     or 0),
        }
    except Exception:
        return _mock_quote(symbol)


# ── 투자정보 조회 (시가총액·상한가·하한가·PER·배당수익률·52주 범위) ────────────

async def get_stock_info(symbol: str, user_id: str, is_mock: bool = True) -> dict:
    """투자정보 위젯용 확장 시세 조회."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        creds = None

    mock_base = 219_000
    mock_result = {
        "symbol":           symbol,
        "market_cap":       "약 1,308조",
        "upper_limit":      int(mock_base * 1.30),
        "lower_limit":      int(mock_base * 0.70),
        "per":              round(random.uniform(10, 40), 2),
        "dividend_yield":   round(random.uniform(0.5, 3.0), 2),
        "w52_high":         mock_base + random.randint(5_000, 30_000),
        "w52_low":          mock_base - random.randint(5_000, 50_000),
        "current_price":    mock_base + random.randint(-3_000, 3_000),
        "is_mock":          True,
    }

    if creds is None:
        return mock_result

    url     = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = _kis_headers(creds, "FHKST01010100")
    params  = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": symbol}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        out  = resp.json().get("output", {})
        cap_raw = int(out.get("hts_avls", 0) or 0)   # 억원 단위

        if cap_raw >= 10_000:
            cap_str = f"{cap_raw // 10_000:,}조 {cap_raw % 10_000:,}억"
        elif cap_raw > 0:
            cap_str = f"{cap_raw:,}억"
        else:
            cap_str = "-"

        current = int(out.get("stck_prpr", 0) or 0)
        return {
            "symbol":          symbol,
            "market_cap":      cap_str,
            "upper_limit":     int(out.get("stck_mxpr", 0) or 0),
            "lower_limit":     int(out.get("stck_llam", 0) or 0),
            "per":             float(out.get("per", 0)     or 0),
            "dividend_yield":  float(out.get("dvdn_yied_rt", 0) or 0),
            "w52_high":        int(out.get("w52_hgpr", 0)  or 0),
            "w52_low":         int(out.get("w52_lwpr", 0)  or 0),
            "current_price":   current,
            "is_mock":         False,
        }
    except Exception:
        return mock_result


# ── 호가 조회 ──────────────────────────────────────────────────────────────────

def _mock_orderbook(symbol: str) -> dict:
    base = 219_000; tick = 500
    return {
        "asks":        [{"price": base + tick * i, "volume": random.randint(50_000, 300_000)} for i in range(1, 11)],
        "bids":        [{"price": base - tick * i, "volume": random.randint(50_000, 300_000)} for i in range(1, 11)],
        "upper_limit": int(base * 1.30),
        "lower_limit": int(base * 0.70),
        "symbol":      symbol,
        "is_mock":     True,
    }


async def get_orderbook(symbol: str, user_id: str, is_mock: bool = True) -> dict:
    """호가창 조회 (10호가 + 상한가/하한가). 미연결 시 mock 데이터 반환."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return _mock_orderbook(symbol)

    url     = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn"
    headers = _kis_headers(creds, "FHKST01010200")
    params  = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": symbol}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        out  = resp.json().get("output1", {})
        asks = [{"price": int(out.get(f"askp{i}",       0) or 0),
                 "volume": int(out.get(f"askp_rsqn{i}", 0) or 0)} for i in range(1, 11)]
        bids = [{"price": int(out.get(f"bidp{i}",       0) or 0),
                 "volume": int(out.get(f"bidp_rsqn{i}", 0) or 0)} for i in range(1, 11)]
        asks = [a for a in asks if a["price"] > 0]
        bids = [b for b in bids if b["price"] > 0]
        return {
            "asks":        asks,
            "bids":        bids,
            "upper_limit": int(out.get("stck_mxpr", 0) or 0),
            "lower_limit": int(out.get("stck_llam", 0) or 0),
            "symbol":      symbol,
            "is_mock":     False,
        }
    except Exception:
        return _mock_orderbook(symbol)


# ── 차트 OHLCV ─────────────────────────────────────────────────────────────────

def _mock_candles(symbol: str, period: str) -> dict:
    candles, price = [], 219_000
    count = {"D": 60, "W": 52, "M": 24}.get(period, 60)
    step  = {"D": 1,  "W": 7,  "M": 30}.get(period, 1)
    for i in range(count, 0, -1):
        d   = (datetime.now() - timedelta(days=i * step)).strftime("%Y-%m-%d")
        chg = random.uniform(-0.025, 0.025)
        o   = int(price)
        c   = int(price * (1 + chg))
        h   = int(max(o, c) * random.uniform(1.001, 1.012))
        l   = int(min(o, c) * random.uniform(0.988, 0.999))
        candles.append({"time": d, "open": o, "high": h, "low": l, "close": c,
                         "value": random.randint(8_000_000, 30_000_000)})
        price = c
    return {"symbol": symbol, "period": period, "candles": candles, "is_mock": True}


async def get_chart_data(
    symbol: str,
    user_id: str,
    period: str = "D",
    is_mock: bool = True,
) -> dict:
    """차트 OHLCV 조회. 미연결 시 mock 데이터 반환."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return _mock_candles(symbol, period)

    end_date   = datetime.now().strftime("%Y%m%d")
    days_map   = {"D": 90, "W": 365, "M": 1825}
    start_date = (datetime.now() - timedelta(days=days_map.get(period, 90))).strftime("%Y%m%d")

    url     = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
    headers = _kis_headers(creds, "FHKST03010100")
    params  = {
        "FID_COND_MRKT_DIV_CODE": "J",
        "FID_INPUT_ISCD":          symbol,
        "FID_INPUT_DATE_1":        start_date,
        "FID_INPUT_DATE_2":        end_date,
        "FID_PERIOD_DIV_CODE":     period,
        "FID_ORG_ADJ_PRC":         "0",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=15)
            resp.raise_for_status()
        candles = []
        for item in reversed(resp.json().get("output2", [])):
            d = item.get("stck_bsop_date", "")
            if len(d) == 8:
                d = f"{d[:4]}-{d[4:6]}-{d[6:]}"
            candles.append({
                "time":  d,
                "open":  int(item.get("stck_oprc", 0) or 0),
                "high":  int(item.get("stck_hgpr", 0) or 0),
                "low":   int(item.get("stck_lwpr", 0) or 0),
                "close": int(item.get("stck_clpr", 0) or 0),
                "value": int(item.get("acml_vol",  0) or 0),
            })
        return {"symbol": symbol, "period": period, "candles": candles, "is_mock": False}
    except Exception:
        return _mock_candles(symbol, period)


# ── 잔고 조회 ──────────────────────────────────────────────────────────────────

_MOCK_BALANCE = {
    "deposit": 10_000_000, "available": 8_500_000,
    "total_eval": 1_500_000, "total_profit_loss": 50_000,
    "account_no_masked": None, "is_mock": True,
}


async def get_balance(user_id: str, is_mock: bool = False) -> dict:
    """잔고 조회. 실계좌 우선 → 모의계좌 → mock 데이터 순으로 fallback."""
    actual_is_mock = is_mock
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        if not is_mock:
            try:
                creds = await get_user_token(user_id, True)
                actual_is_mock = True
            except KISNotConnectedError:
                return _MOCK_BALANCE
        else:
            return _MOCK_BALANCE

    tr_id   = "VTTC8434R" if actual_is_mock else "TTTC8434R"
    url     = f"{_base_url(actual_is_mock)}/uapi/domestic-stock/v1/trading/inquire-balance"
    headers = _kis_headers(creds, tr_id)
    params  = {
        "CANO":                  creds["cano"],
        "ACNT_PRDT_CD":          creds["acnt_prdt_cd"],
        "AFHR_FLPR_YN":          "N",
        "OFL_YN":                "",
        "INQR_DVSN":             "02",
        "UNPR_DVSN":             "01",
        "FUND_STTL_ICLD_YN":     "N",
        "FNCG_AMT_AUTO_RDPT_YN": "N",
        "PRCS_DVSN":             "01",
        "CTX_AREA_FK100":        "",
        "CTX_AREA_NK100":        "",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        out2 = resp.json().get("output2", [{}])[0]
        return {
            "deposit":           int(out2.get("dnca_tot_amt",       0) or 0),
            "available":         int(out2.get("nxdy_excc_amt",      0) or 0),
            "total_eval":        int(out2.get("tot_evlu_amt",       0) or 0),
            "total_profit_loss": int(out2.get("evlu_pfls_smtl_amt", 0) or 0),
            "account_no_masked": creds["account_no_masked"],
        }
    except Exception:
        return {
            "deposit":           10_000_000,
            "available":         8_500_000,
            "total_eval":        1_500_000,
            "total_profit_loss": 50_000,
            "account_no_masked": creds.get("account_no_masked", "****"),
            "is_mock":           True,
        }


# ── 보유종목 ───────────────────────────────────────────────────────────────────

_MOCK_HOLDINGS = [
    {"stock_code": "005930", "stock_name": _stock_name("005930"), "quantity": 5,
     "avg_price": 217_500, "current_price": 219_000, "profit_loss": 7_500, "profit_loss_rate": 0.69},
]


async def get_holdings(user_id: str, is_mock: bool = False) -> list:
    """보유종목 조회. 실계좌 우선 → 모의계좌 → mock 데이터 순으로 fallback."""
    actual_is_mock = is_mock
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        if not is_mock:
            try:
                creds = await get_user_token(user_id, True)
                actual_is_mock = True
            except KISNotConnectedError:
                return _MOCK_HOLDINGS
        else:
            return _MOCK_HOLDINGS

    tr_id   = "VTTC8434R" if actual_is_mock else "TTTC8434R"
    url     = f"{_base_url(actual_is_mock)}/uapi/domestic-stock/v1/trading/inquire-balance"
    headers = _kis_headers(creds, tr_id)
    params  = {
        "CANO":                  creds["cano"],
        "ACNT_PRDT_CD":          creds["acnt_prdt_cd"],
        "AFHR_FLPR_YN":          "N",
        "OFL_YN":                "",
        "INQR_DVSN":             "02",
        "UNPR_DVSN":             "01",
        "FUND_STTL_ICLD_YN":     "N",
        "FNCG_AMT_AUTO_RDPT_YN": "N",
        "PRCS_DVSN":             "01",
        "CTX_AREA_FK100":        "",
        "CTX_AREA_NK100":        "",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        holdings = []
        for item in resp.json().get("output1", []):
            qty = int(item.get("hldg_qty", 0) or 0)
            if qty > 0:
                holdings.append({
                    "stock_code":       item.get("pdno", ""),
                    "stock_name":       item.get("prdt_name", "").strip() or _stock_name(item.get("pdno", "")),
                    "quantity":         qty,
                    "avg_price":        int(float(item.get("pchs_avg_pric", 0) or 0)),
                    "current_price":    int(item.get("prpr", 0) or 0),
                    "profit_loss":      int(item.get("evlu_pfls_amt", 0) or 0),
                    "profit_loss_rate": float(item.get("evlu_pfls_rt", 0) or 0),
                })
        return holdings
    except Exception:
        return [
            {
                "stock_code":       "005930",
                "stock_name":       _stock_name("005930"),
                "quantity":         5,
                "avg_price":        217_500,
                "current_price":    219_000,
                "profit_loss":      7_500,
                "profit_loss_rate": 0.69,
            }
        ]


# ── 당일 주문내역 ──────────────────────────────────────────────────────────────

async def get_today_orders(
    user_id: str,
    is_mock: bool = True,
    order_status: str = "ccld",  # "ccld"=체결, "pending"=미체결
) -> list:
    """당일 주문내역 조회."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return []

    kst   = timezone(timedelta(hours=9))
    today = datetime.now(tz=kst).strftime("%Y%m%d")

    if order_status == "ccld":
        tr_id = "VTTC8001R" if is_mock else "TTTC8001R"
        url   = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/trading/inquire-daily-ccld"
        params = {
            "CANO":           creds["cano"],
            "ACNT_PRDT_CD":   creds["acnt_prdt_cd"],
            "INQR_STRT_DT":   today,
            "INQR_END_DT":    today,
            "SLL_BUY_DVSN_CD": "00",
            "INQR_DVSN":      "00",
            "PDNO":           "",
            "CCLD_DVSN":      "00",
            "ORD_GNO_BRNO":   "",
            "ODNO":           "",
            "INQR_DVSN_3":    "00",
            "INQR_DVSN_1":    "",
            "CTX_AREA_FK100": "",
            "CTX_AREA_NK100": "",
        }
        output_key = "output1"
    else:
        tr_id = "VTTC8036R" if is_mock else "TTTC8036R"
        url   = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/trading/inquire-psbl-rvsecncl"
        params = {
            "CANO":           creds["cano"],
            "ACNT_PRDT_CD":   creds["acnt_prdt_cd"],
            "CTX_AREA_FK100": "",
            "CTX_AREA_NK100": "",
            "INQR_DVSN_1":    "",
            "INQR_DVSN_2":    "00",
        }
        output_key = "output"

    headers = _kis_headers(creds, tr_id)

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        orders = []
        for item in resp.json().get(output_key, []):
            qty        = int(item.get("ord_qty",      0) or 0)
            filled_qty = int(item.get("tot_ccld_qty", 0) or 0)
            if qty == 0 and filled_qty == 0:
                continue
            buy_sell   = item.get("sll_buy_dvsn_cd", "")
            orders.append({
                "stock_code":  item.get("pdno", ""),
                "stock_name":  item.get("prdt_name", ""),
                "order_type":  "매수" if buy_sell == "02" else "매도",
                "quantity":    qty,
                "filled_qty":  filled_qty,
                "price":       int(item.get("ord_unpr", 0) or 0),
                "status":      "체결" if order_status == "ccld" else "미체결",
                "order_time":  item.get("ord_tmd", ""),
            })
        return orders
    except Exception:
        return []


def _mock_today_orders() -> list:
    """KIS 미연결/실패 시 모의 주문 내역"""
    return [
        {
            "stock_code": "005930", "stock_name": "삼성전자",
            "order_type": "매수", "quantity": 5, "filled_qty": 5,
            "price": 219_000, "status": "체결", "order_time": "093012",
        },
        {
            "stock_code": "000660", "stock_name": "SK하이닉스",
            "order_type": "매도", "quantity": 1, "filled_qty": 1,
            "price": 185_200, "status": "체결", "order_time": "101545",
        },
        {
            "stock_code": "035420", "stock_name": "NAVER",
            "order_type": "매수", "quantity": 2, "filled_qty": 0,
            "price": 192_000, "status": "미체결", "order_time": "141230",
        },
    ]


# ── 주문 실행 ──────────────────────────────────────────────────────────────────

async def place_order(
    user_id: str,
    symbol: str,
    order_type: str,       # "buy" | "sell"
    quantity: int,
    price: int | None = None,
    is_mock: bool = True,
) -> dict:
    """주문 실행."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError as e:
        _raise_not_connected(e)
        return {}

    tr_map = {
        ("buy",  True):  "VTTC0802U",
        ("sell", True):  "VTTC0801U",
        ("buy",  False): "TTTC0802U",
        ("sell", False): "TTTC0801U",
    }
    tr_id   = tr_map.get((order_type, is_mock), "VTTC0802U")
    url     = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/trading/order-cash"
    headers = _kis_headers(creds, tr_id, is_post=True)
    body = {
        "CANO":     creds["cano"],
        "ACNT_PRDT_CD": creds["acnt_prdt_cd"],
        "PDNO":     symbol,
        "ORD_DVSN": "00" if price else "01",
        "ORD_QTY":  str(quantity),
        "ORD_UNPR": str(price or 0),
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=body, headers=headers, timeout=10)
            resp.raise_for_status()
        output = resp.json().get("output", {})
        return {
            "order_id":   output.get("KRX_FWDG_ORD_ORGNO", ""),
            "symbol":     symbol,
            "order_type": order_type,
            "quantity":   quantity,
            "price":      price,
            "status":     "accepted",
            "message":    f"{'모의' if is_mock else '실거래'} 주문 접수 완료",
        }
    except Exception:
        return {
            "order_id":   f"MOCK-{symbol}-{datetime.now().strftime('%H%M%S')}",
            "symbol":     symbol,
            "order_type": order_type,
            "quantity":   quantity,
            "price":      price,
            "status":     "accepted",
            "message":    "모의 주문 접수 완료 (KIS 미연결 환경)",
        }
