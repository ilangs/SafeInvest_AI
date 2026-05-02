# stock_data/cleaners/stock_cleaner.py

from datetime import datetime


def clean_ticker(raw):
    """
    종목코드를 항상 6자리 문자열로 변환

    예시:
      clean_ticker('5930')    → '005930'
      clean_ticker(5930)      → '005930'
      clean_ticker('005930')  → '005930'
      clean_ticker('A005930') → '005930'  (앞에 'A'가 붙는 경우)
    """
    s = str(raw).strip()
    # 앞에 알파벳이 붙어있으면 제거 (예: 'A005930')
    if s and s[0].isalpha():
        s = s[1:]
    return s.zfill(6)


def clean_stock_name(name):
    """
    종목 이름 정리
    불필요한 공백을 제거하고 깨끗하게 정리

    예시:
      clean_stock_name(' 삼성전자  ') → '삼성전자'
    """
    if not name:
        return None
    return str(name).strip()


def clean_number(value):
    """
    금액·숫자 문자열을 정수로 변환

    예시:
      clean_number('230,400,881,000,000') → 230400881000000
      clean_number('-1,234')              → -1234
      clean_number('')                    → None
      clean_number('N/A')                → None
    """
    if value is None:
        return None
    s = str(value).strip().replace(',', '')
    if s in ['', '-', 'N/A', 'nan', 'None']:
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return int(float(s))
        except ValueError:
            return None


def clean_ratio(value):
    """
    비율(%) 값을 소수점 2자리 실수로 변환

    예시:
      clean_ratio('15.32')  → 15.32
      clean_ratio('N/A')    → None
    """
    if value is None:
        return None
    s = str(value).strip().replace(',', '').replace('%', '')
    if s in ['', '-', 'N/A', 'nan', 'None']:
        return None
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def clean_date(value, fmt="%Y-%m-%d"):
    """
    날짜 문자열을 표준 형식으로 변환

    예시:
      clean_date('20260425')         → '2026-04-25'
      clean_date('2026-04-25')       → '2026-04-25'
      clean_date('2026.04.25')       → '2026-04-25'
    """
    if value is None:
        return None
    s = str(value).strip().replace('.', '-').replace('/', '-')

    # 'YYYYMMDD' 형식 처리
    if len(s) == 8 and s.isdigit():
        s = f"{s[:4]}-{s[4:6]}-{s[6:8]}"

    try:
        dt = datetime.strptime(s, "%Y-%m-%d")
        return dt.strftime(fmt)
    except ValueError:
        return None