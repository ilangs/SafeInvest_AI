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
    """종목코드로 한국어 종목명 반환. 우선순위: Supabase stocks → 하드코드 → 코드."""
    cached = _STOCK_NAME_CACHE.get(symbol)
    if cached:
        return cached
    try:
        from app.core.supabase import supabase_admin
        res = (
            supabase_admin.table("stocks")
            .select("stock_name")
            .eq("ticker", symbol)
            .maybe_single()
            .execute()
        )
        if res and res.data and res.data.get("stock_name"):
            name = res.data["stock_name"]
            _STOCK_NAME_CACHE[symbol] = name
            return name
    except Exception:
        pass
    return _KR_STOCK_NAMES.get(symbol, symbol)


# 종목명 캐시 (Supabase 조회 비용 절감)
_STOCK_NAME_CACHE: dict[str, str] = {}

# 마지막 성공 응답 캐시 (KIS API 일시 실패 시 안정적 fallback)
_QUOTE_CACHE:     dict[str, dict]  = {}   # symbol → quote dict
_ORDERBOOK_CACHE: dict[str, dict]  = {}   # symbol → orderbook dict
_INFO_CACHE:      dict[str, dict]  = {}   # symbol → info dict
_BALANCE_CACHE:   dict[tuple, dict] = {}  # (user_id, is_mock) → balance dict
_HOLDINGS_CACHE:  dict[tuple, list] = {}  # (user_id, is_mock) → holdings list

# 당일 주문 로그 — KIS inquire-daily-ccld 가 즉시 반영되지 않는 문제 보완
# Supabase 'user_orders' 테이블에 영구 저장 (서버 재시작/다중워커에도 유지)
# 메모리 캐시는 단기 응답속도 개선용
_LOCAL_ORDER_CACHE: dict[tuple, list] = {}   # (user_id, is_mock, date) → orders


def _today_kst() -> str:
    return datetime.now(tz=timezone(timedelta(hours=9))).strftime("%Y%m%d")


def _now_hms_kst() -> str:
    return datetime.now(tz=timezone(timedelta(hours=9))).strftime("%H%M%S")


# KRX 휴장일 캘린더 — holidays 패키지의 한국 공휴일 + KRX 추가 휴장일
# (offline·경량. 매년 자동 갱신. 설치: pip install holidays)
try:
    import holidays as _holidays_lib
    _KR_HOLIDAYS = _holidays_lib.country_holidays("KR")
except ImportError:
    _KR_HOLIDAYS = None  # 패키지 미설치 시 공휴일 체크는 우회 (주말/시간만 체크)


_MARKET_CLOSED_MSG = (
    "주식시장 거래시간이 아닙니다 "
    "(정규장: 평일 09:00 ~ 15:30 KST, 주말·공휴일 휴장)."
)


def _is_krx_holiday(d) -> bool:
    """
    KRX 휴장일 여부.
    - 한국 공공 공휴일 (holidays 패키지)
    - KRX 연말 휴장: 12월 31일 (평일이어도 휴장)
    """
    if _KR_HOLIDAYS is not None and d in _KR_HOLIDAYS:
        return True
    if d.month == 12 and d.day == 31:
        return True
    return False


def _is_market_open() -> tuple[bool, str]:
    """
    한국 주식시장 정규장 거래 가능 여부.

    체크 순서: 주말 → 공휴일/KRX 휴장일 → 정규장 시간(09:00 ~ 15:30 KST)
    하나라도 만족하지 못하면 동일한 안내 메시지 반환.

    Returns
    -------
    (open?, message)
    """
    now = datetime.now(tz=timezone(timedelta(hours=9)))
    # 주말
    if now.weekday() >= 5:
        return False, _MARKET_CLOSED_MSG
    # 공휴일 / KRX 휴장일
    if _is_krx_holiday(now.date()):
        return False, _MARKET_CLOSED_MSG
    # 정규장 시간 (09:00 ~ 15:30)
    hm = now.hour * 100 + now.minute
    if hm < 900 or hm > 1530:
        return False, _MARKET_CLOSED_MSG
    return True, ""


def _record_local_order(
    user_id: str, is_mock: bool, symbol: str,
    order_type: str, quantity: int, price: int | None, order_id: str,
    status: str = "접수",
):
    """
    주문 성공 시 Supabase + 메모리 캐시에 기록.

    status 기본값은 '접수' — KIS 가 주문을 받아들였다는 의미일 뿐,
    실제 체결 여부는 inquire-daily-ccld 결과로 별도 확인되어야 함.
    체결 확인 시 _sync_local_with_kis_fills() 가 '체결'로 업데이트.
    """
    today = _today_kst()
    now   = _now_hms_kst()
    record = {
        "stock_code":  symbol,
        "stock_name":  _stock_name(symbol),
        "order_type":  "매수" if order_type == "buy" else "매도",
        "quantity":    int(quantity),
        "filled_qty":  int(quantity) if status == "체결" else 0,
        "price":       int(price or 0),
        "status":      status,
        "order_time":  now,
        "order_id":    order_id,
    }
    # 1) Supabase 영구 저장
    try:
        from app.core.supabase import supabase_admin
        supabase_admin.table("user_orders").insert({
            "user_id":      user_id,
            "is_mock":      is_mock,
            "stock_code":   symbol,
            "stock_name":   record["stock_name"],
            "order_type":   order_type,
            "quantity":     int(quantity),
            "price":        int(price or 0),
            "status":       status,
            "order_id_ext": order_id,
            "order_date":   today,
            "order_time":   now,
        }).execute()
    except Exception as e:
        print(f"[user_orders insert 실패] {e}")
    # 2) 메모리 캐시에 추가 (즉시 다음 GET에 반영)
    key = (user_id, is_mock, today)
    _LOCAL_ORDER_CACHE.setdefault(key, []).append(record)


def _sync_local_with_kis_fills(user_id: str, is_mock: bool, kis_filled_orders: list) -> None:
    """
    KIS 체결 확인된 주문의 로컬 status 를 '접수' → '체결' 로 업데이트.
    get_today_orders 가 KIS 응답을 받은 직후 호출됨.
    """
    if not kis_filled_orders:
        return
    filled_ids = {o.get("order_id") for o in kis_filled_orders if o.get("order_id")}
    if not filled_ids:
        return
    try:
        from app.core.supabase import supabase_admin
        supabase_admin.table("user_orders") \
            .update({"status": "체결"}) \
            .eq("user_id", user_id) \
            .eq("is_mock", is_mock) \
            .in_("order_id_ext", list(filled_ids)) \
            .neq("status", "체결") \
            .execute()
        # 캐시 무효화 → 다음 호출 시 최신 상태 재조회
        today = _today_kst()
        _LOCAL_ORDER_CACHE.pop((user_id, is_mock, today), None)
        _HOLDINGS_CACHE.pop((user_id, is_mock), None)
    except Exception as e:
        print(f"[order sync 실패] {e}")


def _local_order_bucket(user_id: str, is_mock: bool) -> list:
    """오늘(KST) 주문 로그를 Supabase에서 로드 (캐시 사용)."""
    today = _today_kst()
    key   = (user_id, is_mock, today)
    if key in _LOCAL_ORDER_CACHE:
        return _LOCAL_ORDER_CACHE[key]
    # Supabase에서 로드
    orders: list = []
    try:
        from app.core.supabase import supabase_admin
        res = (
            supabase_admin.table("user_orders")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_mock", is_mock)
            .eq("order_date", today)
            .order("order_time", desc=True)
            .execute()
        )
        for r in (res.data or []):
            orders.append({
                "stock_code":  r.get("stock_code", ""),
                "stock_name":  r.get("stock_name") or _stock_name(r.get("stock_code", "")),
                "order_type":  "매수" if r.get("order_type") == "buy" else "매도",
                "quantity":    int(r.get("quantity") or 0),
                "filled_qty":  int(r.get("quantity") or 0),
                "price":       int(r.get("price") or 0),
                "status":      r.get("status") or "체결",
                "order_time":  r.get("order_time", ""),
                "order_id":    r.get("order_id_ext", ""),
            })
    except Exception as e:
        print(f"[user_orders 조회 실패] {e}")
    _LOCAL_ORDER_CACHE[key] = orders
    return orders


def _supabase_latest_close(symbol: str) -> tuple[int, int]:
    """
    Supabase stock_prices에서 최근 2일치 종가 반환 → (latest, previous).
    데이터 없으면 (0, 0).
    """
    try:
        from app.core.supabase import supabase_admin
        res = (
            supabase_admin.table("stock_prices")
            .select("trade_date, close_price")
            .eq("ticker", symbol)
            .order("trade_date", desc=True)
            .limit(2)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return 0, 0
        latest = int(rows[0].get("close_price") or 0)
        prev   = int(rows[1].get("close_price") or 0) if len(rows) > 1 else latest
        return latest, prev
    except Exception:
        return 0, 0


# ── 현재가 조회 ────────────────────────────────────────────────────────────────

def _fallback_quote(symbol: str) -> dict:
    """KIS API 실패 시 deterministic fallback. 1순위: 직전 성공 캐시, 2순위: Supabase 최근 종가."""
    cached = _QUOTE_CACHE.get(symbol)
    if cached:
        return cached
    latest, prev = _supabase_latest_close(symbol)
    change = latest - prev if (latest and prev) else 0
    rate   = round((change / prev) * 100, 2) if prev else 0.0
    return {
        "symbol":        symbol,
        "name":          _stock_name(symbol),
        "current_price": latest,
        "change":        change,
        "change_rate":   rate,
        "volume":        0,
    }


async def get_quote(symbol: str, user_id: str, is_mock: bool = True) -> dict:
    """현재가 조회. KIS 실패 시 직전 성공 캐시 → Supabase 최근 종가 순으로 fallback."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return _fallback_quote(symbol)

    url     = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = _kis_headers(creds, "FHKST01010100")
    params  = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": symbol}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        output = resp.json().get("output", {})
        price  = int(output.get("stck_prpr", 0) or 0)
        # KIS가 0을 리턴(장외/오류) → fallback 사용
        if price <= 0:
            return _fallback_quote(symbol)
        name = output.get("hts_kor_isnm", "").strip() or _stock_name(symbol)
        result = {
            "symbol":        symbol,
            "name":          name,
            "current_price": price,
            "change":        int(output.get("prdy_vrss", 0)    or 0),
            "change_rate":   float(output.get("prdy_ctrt", 0)  or 0),
            "volume":        int(output.get("acml_vol", 0)     or 0),
        }
        _QUOTE_CACHE[symbol] = result
        return result
    except Exception:
        return _fallback_quote(symbol)


# ── 투자정보 조회 (시가총액·상한가·하한가·PER·배당수익률·52주 범위) ────────────

def _fallback_stock_info(symbol: str) -> dict:
    """투자정보 fallback: 캐시 → Supabase 최근 종가 기반."""
    cached = _INFO_CACHE.get(symbol)
    if cached:
        return cached
    latest, _ = _supabase_latest_close(symbol)
    return {
        "symbol":         symbol,
        "market_cap":     "-",
        "upper_limit":    int(latest * 1.30) if latest else 0,
        "lower_limit":    int(latest * 0.70) if latest else 0,
        "per":            0.0,
        "dividend_yield": 0.0,
        "w52_high":       0,
        "w52_low":        0,
        "current_price":  latest,
        "is_mock":        True,
    }


async def get_stock_info(symbol: str, user_id: str, is_mock: bool = True) -> dict:
    """투자정보 위젯용 확장 시세 조회."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return _fallback_stock_info(symbol)

    url     = f"{_base_url(is_mock)}/uapi/domestic-stock/v1/quotations/inquire-price"
    headers = _kis_headers(creds, "FHKST01010100")
    params  = {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": symbol}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=10)
            resp.raise_for_status()
        out  = resp.json().get("output", {})
        current = int(out.get("stck_prpr", 0) or 0)
        if current <= 0:
            return _fallback_stock_info(symbol)
        cap_raw = int(out.get("hts_avls", 0) or 0)   # 억원 단위
        if cap_raw >= 10_000:
            cap_str = f"{cap_raw // 10_000:,}조 {cap_raw % 10_000:,}억"
        elif cap_raw > 0:
            cap_str = f"{cap_raw:,}억"
        else:
            cap_str = "-"

        result = {
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
        _INFO_CACHE[symbol] = result
        return result
    except Exception:
        return _fallback_stock_info(symbol)


# ── 호가 조회 ──────────────────────────────────────────────────────────────────

def _fallback_orderbook(symbol: str) -> dict:
    """
    호가 fallback: 캐시 → 종가 기준 ±tick × i 의 deterministic 10호가.
    랜덤 사용 안 함 (5초 폴링에서 가격 진동 방지).
    """
    cached = _ORDERBOOK_CACHE.get(symbol)
    if cached:
        return cached
    latest, _ = _supabase_latest_close(symbol)
    if latest <= 0:
        return {
            "asks": [], "bids": [],
            "upper_limit": 0, "lower_limit": 0,
            "symbol": symbol, "is_mock": True,
        }
    # 호가 단위(틱) 추정: 가격대별 KRX 호가단위
    if   latest >= 500_000: tick = 1000
    elif latest >= 100_000: tick = 500
    elif latest >= 50_000:  tick = 100
    elif latest >= 10_000:  tick = 50
    elif latest >= 5_000:   tick = 10
    elif latest >= 1_000:   tick = 5
    else:                   tick = 1
    return {
        "asks":        [{"price": latest + tick * i, "volume": 0} for i in range(1, 11)],
        "bids":        [{"price": latest - tick * i, "volume": 0} for i in range(1, 11)],
        "upper_limit": int(latest * 1.30),
        "lower_limit": int(latest * 0.70),
        "symbol":      symbol,
        "is_mock":     True,
    }


async def get_orderbook(symbol: str, user_id: str, is_mock: bool = True) -> dict:
    """호가창 조회 (10호가 + 상한가/하한가). KIS 실패 시 deterministic fallback."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return _fallback_orderbook(symbol)

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
        # 장 마감/시간외 → 호가 비어있으면 deterministic fallback
        if not asks and not bids:
            return _fallback_orderbook(symbol)
        result = {
            "asks":        asks,
            "bids":        bids,
            "upper_limit": int(out.get("stck_mxpr", 0) or 0),
            "lower_limit": int(out.get("stck_llam", 0) or 0),
            "symbol":      symbol,
            "is_mock":     False,
        }
        _ORDERBOOK_CACHE[symbol] = result
        return result
    except Exception:
        return _fallback_orderbook(symbol)


# ── 차트 OHLCV ─────────────────────────────────────────────────────────────────

def _fallback_candles(symbol: str, period: str) -> dict:
    """차트 fallback: Supabase stock_prices 일봉 → 주봉/월봉 집계."""
    try:
        from app.core.supabase import supabase_admin
        # 일봉 2년 + 주/월봉 충분한 분량
        days_map = {"D": 730, "W": 365 * 5, "M": 365 * 10}
        limit    = days_map.get(period, 730)
        res = (
            supabase_admin.table("stock_prices")
            .select("trade_date,open_price,high_price,low_price,close_price,volume")
            .eq("ticker", symbol)
            .order("trade_date", desc=True)
            .limit(limit)
            .execute()
        )
        rows = list(reversed(res.data or []))
    except Exception:
        rows = []

    daily = []
    for r in rows:
        d = r.get("trade_date", "")
        if len(d) == 8:
            d = f"{d[:4]}-{d[4:6]}-{d[6:]}"
        daily.append({
            "time":  d,
            "open":  int(r.get("open_price")  or 0),
            "high":  int(r.get("high_price")  or 0),
            "low":   int(r.get("low_price")   or 0),
            "close": int(r.get("close_price") or 0),
            "value": int(r.get("volume")      or 0),
        })

    if period == "D" or not daily:
        return {"symbol": symbol, "period": period, "candles": daily, "is_mock": True}

    # 주봉/월봉 집계
    from collections import OrderedDict
    bucket_key = (lambda t: t[:7]) if period == "M" else (
        lambda t: datetime.strptime(t, "%Y-%m-%d").strftime("%G-W%V")
    )
    grouped = OrderedDict()
    for c in daily:
        k = bucket_key(c["time"])
        if k not in grouped:
            grouped[k] = {"time": c["time"], "open": c["open"], "high": c["high"],
                          "low": c["low"], "close": c["close"], "value": c["value"]}
        else:
            g = grouped[k]
            g["high"]  = max(g["high"],  c["high"])
            g["low"]   = min(g["low"],   c["low"])
            g["close"] = c["close"]
            g["value"] += c["value"]
    return {"symbol": symbol, "period": period, "candles": list(grouped.values()), "is_mock": True}


async def get_chart_data(
    symbol: str,
    user_id: str,
    period: str = "D",
    is_mock: bool = True,
) -> dict:
    """
    차트 OHLCV 조회.
    Supabase(2년+ 전체 히스토리) 를 기본 소스로 사용하고,
    KIS API(최근 ~100일) 데이터로 가장 최신 캔들을 보강.

    KIS API 단일 요청 제약(약 100건) 때문에 KIS 단독으로는 2년치를 못 받아서
    Supabase 베이스 + KIS 보강 방식으로 변경.
    """
    # 1) Supabase 베이스 (2년)
    base = _fallback_candles(symbol, period)
    base_candles = base.get("candles", [])

    # 2) KIS API 추가 호출 (최신 일자 보강용)
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return {**base, "is_mock": True}

    end_date   = datetime.now().strftime("%Y%m%d")
    days_map   = {"D": 100, "W": 365, "M": 365 * 5}    # KIS 단일 요청 한계 100일
    start_date = (datetime.now() - timedelta(days=days_map.get(period, 100))).strftime("%Y%m%d")

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

    kis_candles = []
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=15)
            resp.raise_for_status()
        for item in reversed(resp.json().get("output2", [])):
            d = item.get("stck_bsop_date", "")
            if len(d) == 8:
                d = f"{d[:4]}-{d[4:6]}-{d[6:]}"
            close = int(item.get("stck_clpr", 0) or 0)
            if close <= 0:
                continue
            kis_candles.append({
                "time":  d,
                "open":  int(item.get("stck_oprc", 0) or 0),
                "high":  int(item.get("stck_hgpr", 0) or 0),
                "low":   int(item.get("stck_lwpr", 0) or 0),
                "close": close,
                "value": int(item.get("acml_vol",  0) or 0),
            })
    except Exception:
        kis_candles = []

    # 3) 병합: Supabase 베이스 + KIS 최신 (날짜 기준 dedup, KIS 우선)
    if not kis_candles:
        return {**base, "is_mock": True}

    by_date = {c["time"]: c for c in base_candles}
    for c in kis_candles:
        by_date[c["time"]] = c   # KIS 데이터로 덮어쓰기 (가장 최신)

    merged = sorted(by_date.values(), key=lambda x: x["time"])
    return {
        "symbol":  symbol,
        "period":  period,
        "candles": merged,
        "is_mock": len(base_candles) > 0 and not kis_candles,
    }


# ── 잔고 조회 ──────────────────────────────────────────────────────────────────

def _empty_balance(account_no_masked: str | None = None) -> dict:
    """랜덤/하드코드 mock 없이 0으로 채워진 빈 잔고."""
    return {
        "deposit":           0,
        "available":         0,
        "total_eval":        0,
        "total_profit_loss": 0,
        "account_no_masked": account_no_masked,
    }


def _fallback_balance(user_id: str, is_mock: bool, account_no_masked: str | None = None) -> dict:
    """KIS 실패 시 직전 성공 캐시 → 빈 잔고."""
    cached = _BALANCE_CACHE.get((user_id, is_mock))
    if cached:
        return cached
    return _empty_balance(account_no_masked)


async def get_balance(user_id: str, is_mock: bool = False) -> dict:
    """잔고 조회. 실계좌 우선 → 모의계좌. KIS 실패 시 직전 캐시 또는 0 반환."""
    actual_is_mock = is_mock
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        if not is_mock:
            try:
                creds = await get_user_token(user_id, True)
                actual_is_mock = True
            except KISNotConnectedError:
                return _fallback_balance(user_id, is_mock)
        else:
            return _fallback_balance(user_id, is_mock)

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
        deposit    = int(out2.get("dnca_tot_amt",       0) or 0)   # 예수금총금액
        d2_cash    = int(out2.get("prvs_rcdl_excc_amt", 0) or 0)   # 가수도정산금액(D+2)
        total_eval = int(out2.get("tot_evlu_amt",       0) or 0)   # 총평가금액
        scts_eval  = int(out2.get("scts_evlu_amt",      0) or 0)   # 유가증권평가금액
        # 매수가능금액 우선순위:
        #  ① D+2 가수도정산금액 (실시간 차감 반영)
        #  ② 총평가 - 유가증권평가 (현금 = 평가 - 주식)
        #  ③ 예수금 (마지막 fallback)
        if d2_cash > 0:
            available = d2_cash
        elif total_eval > 0 and scts_eval >= 0:
            available = total_eval - scts_eval
        else:
            available = deposit
        result = {
            "deposit":           deposit,
            "available":         available,
            "total_eval":        total_eval,
            "total_profit_loss": int(out2.get("evlu_pfls_smtl_amt", 0) or 0),
            "account_no_masked": creds["account_no_masked"],
        }
        _BALANCE_CACHE[(user_id, actual_is_mock)] = result
        return result
    except Exception:
        return _fallback_balance(user_id, actual_is_mock, creds.get("account_no_masked"))


# ── 보유종목 ───────────────────────────────────────────────────────────────────

def _fallback_holdings(user_id: str, is_mock: bool) -> list:
    """KIS 실패 시 직전 성공 캐시 → 빈 배열."""
    return _HOLDINGS_CACHE.get((user_id, is_mock), [])


def _merge_holdings_with_local(holdings: list, user_id: str, is_mock: bool) -> list:
    """
    KIS 보유종목 + Supabase user_orders 당일 주문 병합.
    KIS inquire-balance 가 갓 체결된 주문을 즉시 반영하지 않는 문제 보완.

    동작:
      매수 → 종목 없으면 신규 추가 / 있으면 수량 누적 + 평단가 가중평균
      매도 → 수량 차감 / 0 이하면 제거
    """
    local_orders = _local_order_bucket(user_id, is_mock)
    if not local_orders:
        return holdings

    # 종목코드 → holding 인덱스 맵 (얕은 복사로 원본 보호)
    h_map = {h["stock_code"]: dict(h) for h in holdings}

    for o in local_orders:
        # ★ 체결된 주문만 반영 — '접수' 상태는 KIS 확인 전이므로 보유종목 미반영
        if o.get("status") != "체결":
            continue
        code   = o["stock_code"]
        qty    = int(o["quantity"])
        price  = int(o["price"])
        is_buy = (o["order_type"] == "매수")

        cur = h_map.get(code)
        if is_buy:
            if cur:
                # 가중평균 평단가
                total_qty = cur["quantity"] + qty
                cur["avg_price"] = int(
                    (cur["avg_price"] * cur["quantity"] + price * qty) / total_qty
                ) if total_qty > 0 else price
                cur["quantity"] = total_qty
            else:
                h_map[code] = {
                    "stock_code":       code,
                    "stock_name":       o["stock_name"],
                    "quantity":         qty,
                    "avg_price":        price,
                    "current_price":    price,   # 시세 미상 → 매수가로 fallback
                    "profit_loss":      0,
                    "profit_loss_rate": 0.0,
                }
        else:  # 매도
            if cur:
                cur["quantity"] -= qty
                if cur["quantity"] <= 0:
                    h_map.pop(code, None)
                # 평단가 유지, 손익 재계산은 KIS 다음 호출 때 정확해짐

    return list(h_map.values())


async def get_holdings(user_id: str, is_mock: bool = False) -> list:
    """보유종목 조회. 실계좌 우선 → 모의계좌. KIS 실패 시 직전 캐시 또는 빈 배열."""
    actual_is_mock = is_mock
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        if not is_mock:
            try:
                creds = await get_user_token(user_id, True)
                actual_is_mock = True
            except KISNotConnectedError:
                return _fallback_holdings(user_id, is_mock)
        else:
            return _fallback_holdings(user_id, is_mock)

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
        merged = _merge_holdings_with_local(holdings, user_id, actual_is_mock)
        _HOLDINGS_CACHE[(user_id, actual_is_mock)] = merged
        return merged
    except Exception:
        fallback = _fallback_holdings(user_id, actual_is_mock)
        return _merge_holdings_with_local(fallback, user_id, actual_is_mock)


# ── 당일 주문내역 ──────────────────────────────────────────────────────────────

def _normalize_date(s: str | None) -> str | None:
    """YYYY-MM-DD 또는 YYYYMMDD → YYYYMMDD 정규화."""
    if not s:
        return None
    digits = "".join(ch for ch in s if ch.isdigit())
    return digits[:8] if len(digits) >= 8 else None


async def get_order_history(
    user_id: str,
    is_mock: bool = True,
    start_date: str | None = None,
    end_date:   str | None = None,
) -> list:
    """기간 매매내역 조회 — Supabase user_orders 테이블 기반.
    날짜 미지정 시 오늘 하루."""
    today = _today_kst()
    start = _normalize_date(start_date) or today
    end   = _normalize_date(end_date)   or today
    # 시작일 > 종료일 인 경우 swap
    if start > end:
        start, end = end, start

    try:
        from app.core.supabase import supabase_admin
        res = (
            supabase_admin.table("user_orders")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_mock", is_mock)
            .gte("order_date", start)
            .lte("order_date", end)
            .order("order_date", desc=True)
            .order("order_time", desc=True)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"[order_history 조회 실패] {e}")
        rows = []

    return [{
        "stock_code":  r.get("stock_code", ""),
        "stock_name":  r.get("stock_name") or _stock_name(r.get("stock_code", "")),
        "order_type":  "매수" if r.get("order_type") == "buy" else "매도",
        "quantity":    int(r.get("quantity") or 0),
        "filled_qty":  int(r.get("quantity") or 0),
        "price":       int(r.get("price") or 0),
        "status":      r.get("status") or "체결",
        "order_date":  r.get("order_date", ""),
        "order_time":  r.get("order_time", ""),
        "order_id":    r.get("order_id_ext", ""),
    } for r in rows]


def _merge_with_local(kis_orders: list, user_id: str, is_mock: bool, status: str) -> list:
    """KIS API 결과 + 로컬 주문 로그 병합 (order_id 기준 중복 제거).
    체결("ccld") 상태일 때만 로컬 로그를 병합 — 로컬 기록은 모두 체결 가정."""
    if status != "ccld":
        return kis_orders
    local = _local_order_bucket(user_id, is_mock)
    if not local:
        return kis_orders
    # 중복 키: (stock_code, order_time, quantity, order_type)
    seen = {(o.get("stock_code"), o.get("order_time"), o.get("quantity"), o.get("order_type")) for o in kis_orders}
    merged = list(kis_orders)
    for lo in local:
        k = (lo["stock_code"], lo["order_time"], lo["quantity"], lo["order_type"])
        if k not in seen:
            merged.append(lo)
    # 시간순 내림차순(최신 우선)
    merged.sort(key=lambda o: o.get("order_time", ""), reverse=True)
    return merged


async def get_today_orders(
    user_id: str,
    is_mock: bool = True,
    order_status: str = "ccld",  # "ccld"=체결, "pending"=미체결
) -> list:
    """당일 주문내역 조회. KIS API + 로컬 주문 로그 병합."""
    try:
        creds = await get_user_token(user_id, is_mock)
    except KISNotConnectedError:
        return _merge_with_local([], user_id, is_mock, order_status)

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
                "stock_name":  item.get("prdt_name", "").strip() or _stock_name(item.get("pdno", "")),
                "order_type":  "매수" if buy_sell == "02" else "매도",
                "quantity":    qty,
                "filled_qty":  filled_qty,
                "price":       int(item.get("ord_unpr", 0) or 0),
                "status":      "체결" if order_status == "ccld" else "미체결",
                "order_time":  item.get("ord_tmd", ""),
            })
        # ★ KIS 체결 확인된 주문의 로컬 status를 '접수' → '체결' 동기화
        if order_status == "ccld":
            _sync_local_with_kis_fills(user_id, is_mock, orders)
        return _merge_with_local(orders, user_id, is_mock, order_status)
    except Exception:
        return _merge_with_local([], user_id, is_mock, order_status)


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
    # ★ 거래시간 체크 — 장 마감 / 주말 / 공휴일에는 주문 거부 (가짜 체결 방지)
    market_open, market_msg = _is_market_open()
    if not market_open:
        return {
            "order_id":   "",
            "symbol":     symbol,
            "order_type": order_type,
            "quantity":   quantity,
            "price":      price,
            "status":     "rejected",
            "message":    f"주문 거부 — {market_msg}",
        }

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
        output   = resp.json().get("output", {})
        order_id = output.get("KRX_FWDG_ORD_ORGNO", "") or f"KIS-{symbol}-{datetime.now().strftime('%H%M%S')}"
        # 로컬 주문 로그에 기록 — KIS inquire-daily-ccld 지연/누락 보완
        _record_local_order(user_id, is_mock, symbol, order_type, quantity, price, order_id)
        return {
            "order_id":   order_id,
            "symbol":     symbol,
            "order_type": order_type,
            "quantity":   quantity,
            "price":      price,
            "status":     "accepted",
            "message":    f"{'모의' if is_mock else '실거래'} 주문 접수 완료",
        }
    except Exception as e:
        # ★ KIS 통신 실패 — 가짜 체결 기록 금지. 사용자에게 명시적 거부 메시지.
        return {
            "order_id":   "",
            "symbol":     symbol,
            "order_type": order_type,
            "quantity":   quantity,
            "price":      price,
            "status":     "rejected",
            "message":    f"KIS 주문 전송 실패 — {str(e)[:120]}",
        }
