"""
SafeInvest AI 자체 제작 콘텐츠 (✨ 기본기 탭).

학습경로/교육센터와 완전 분리되어 별도 탭으로 노출됨.
저작권: SafeInvest AI 소유 (자체 제작).

콘텐츠 구성 (총 10편):
  - 입문 패키지 (5편): A01, B01, C04, D01, E01
    각 카테고리에서 1편씩, "특정 개념 깊이"
  - 통합 가이드 (5편): F01~F05
    "주식 투자 5편으로 시작하기" 종합 가이드
"""

# ────────────────────────────────────────
# 6개 카테고리 정의 (F 카테고리 추가)
# ────────────────────────────────────────
SELF_CATEGORIES = [
    {
        "code": "A",
        "name": "재무 지표",
        "icon": "💰",
        "description": "PER, PBR, ROE 등 핵심 재무 지표 정복",
    },
    {
        "code": "B",
        "name": "재무제표",
        "icon": "📊",
        "description": "손익계산서, 재무상태표, 현금흐름표 읽기",
    },
    {
        "code": "C",
        "name": "시장 기초",
        "icon": "🌍",
        "description": "코스피, 강세장/약세장, 금리/환율의 영향",
    },
    {
        "code": "D",
        "name": "투자 원칙",
        "icon": "🎯",
        "description": "분산투자, 자산배분, 위험 관리의 기본",
    },
    {
        "code": "E",
        "name": "뉴스 해석",
        "icon": "📰",
        "description": "실적 발표, 금리 결정, 공시 읽는 법",
    },
    {
        "code": "F",
        "name": "통합 가이드",
        "icon": "🗺️",
        "description": "주식 투자 5편으로 시작하기 - 종합 가이드",
    },
]


# ────────────────────────────────────────
# 자체 콘텐츠 목록 (총 10편)
# ────────────────────────────────────────
# 추가 시 영상을 static/videos/ 폴더에 넣고 아래 리스트에 항목 추가.
SELF_CONTENTS = [
    
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 통합 가이드 (5편) - "주식 투자 5편으로 시작하기"
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ─── 통합 1편: 왜 투자하나 ───
    {
        "contents_slno": "self_F01",
        "title": "[통합 1편] 내 돈이 일하게 만드는 법 - 주식 투자, 왜 시작해야 하나",
        "summary": "예금 vs 주식의 본질적 차이. 복리의 마법(72의 법칙)으로 30년 후 차이가 폭발적인 이유.",
        "category_code": "F",
        "video_path": "/static/videos/self_F01_why_invest.mp4",
        "thumbnail": None,
        "playtime_minutes": 8,
        "producing_yr": "2026",
        "tags": ["주식의본질", "복리", "노동소득", "자산소득", "통합가이드"],
        "learning_objectives": [
            "노동 소득 vs 자산 소득의 차이",
            "예금(채권자) vs 주식(주주)의 본질적 차이",
            "복리의 마법과 72의 법칙",
            "인플레이션이 예금을 갉아먹는 이유",
            "투자 시작 전 마음의 준비 3가지",
        ],
    },

    # ─── 통합 2편: 좋은 회사 찾기 ───
    {
        "contents_slno": "self_F02",
        "title": "[통합 2편] 좋은 회사를 찾는 돋보기 - 재무제표 3가지 핵심 지표",
        "summary": "맛집 인수 비유로 회사 분석. 매출/영업이익/부채비율 3가지로 좋은 회사 80% 판단.",
        "category_code": "F",
        "video_path": "/static/videos/self_F02_finding_good_company.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["회사분석", "재무제표", "매출", "영업이익", "부채비율", "통합가이드"],
        "learning_objectives": [
            "좋은 회사 판단 3가지 핵심 지표",
            "매출 성장 패턴 읽기",
            "영업이익률의 의미 (본업의 실력)",
            "부채비율 적정 수준 (업종별 차이)",
            "DART와 네이버 증권 활용법",
        ],
    },

    # ─── 통합 3편: 차트 분석 ───
    {
        "contents_slno": "self_F03",
        "title": "[통합 3편] 차트는 미래를 보여주는 거울일까? - 기술적 분석 기초",
        "summary": "차트는 점술 도구가 아니라 군중 심리의 기록. 캔들/이동평균선/거래량 3가지만 알면 80%.",
        "category_code": "F",
        "video_path": "/static/videos/self_F03_chart_basics.mp4",
        "thumbnail": None,
        "playtime_minutes": 10,
        "producing_yr": "2026",
        "tags": ["차트분석", "캔들", "이동평균선", "거래량", "기술적분석", "통합가이드"],
        "learning_objectives": [
            "캔들 차트 보는 법 (양봉/음봉)",
            "이동평균선과 정배열/역배열의 의미",
            "거래량이 가격보다 정직한 이유",
            "차트의 한계 (미래 예측 X, 펀더멘털 못 이김)",
            "차트가 정말 도움 되는 경우 (과열 회피, 손절 기준)",
        ],
    },

    # ─── 통합 4편: 포트폴리오와 분산 ───
    {
        "contents_slno": "self_F04",
        "title": "[통합 4편] 계란을 한 바구니에 담지 않는 기술 - 포트폴리오와 분산",
        "summary": "코로나 폭락기 3명의 다른 결과. 종목/섹터/자산 3차원 분산과 상관관계의 비밀.",
        "category_code": "F",
        "video_path": "/static/videos/self_F04_portfolio.mp4",
        "thumbnail": None,
        "playtime_minutes": 10,
        "producing_yr": "2026",
        "tags": ["포트폴리오", "분산투자", "자산배분", "상관관계", "리밸런싱", "통합가이드"],
        "learning_objectives": [
            "분산의 3가지 차원: 종목/섹터/자산",
            "상관관계가 분산 효과의 핵심인 이유",
            "한국 주요 섹터와 분산 가이드",
            "나이별 자산 배분 비율",
            "리밸런싱과 ETF 활용법",
        ],
    },

    # ─── 통합 5편: 투자 심리학 ───
    {
        "contents_slno": "self_F05",
        "title": "[통합 5편] 내 마음을 다스리는 투자 심리학 - 가장 큰 적은 나 자신",
        "summary": "주가 변동에 따른 심리 곡선. 손실 회피, 확증 편향, FOMO 등 5가지 핵심 편향.",
        "category_code": "F",
        "video_path": "/static/videos/self_F05_psychology.mp4",
        "thumbnail": None,
        "playtime_minutes": 11,
        "producing_yr": "2026",
        "tags": ["투자심리", "손실회피", "확증편향", "FOMO", "마인드셋", "통합가이드"],
        "learning_objectives": [
            "투자자 심리 곡선 (의심→환희→공포→절망)",
            "손실 회피 편향: 이익은 짧게, 손실은 길게",
            "확증 편향과 FOMO의 함정",
            "자기 자신을 이기는 5가지 원칙",
            "매매 원칙 미리 정해두기",
        ],
    },    
    
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 입문 패키지 (5편) - 각 카테고리에서 1편씩
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ─── 입문 1편: PER ───
    {
        "contents_slno": "self_A01",
        "title": "[입문 1편] PER - 주식이 비싼지 싼지 알려주는 첫 번째 숫자",
        "summary": "PER이 뭔지 카페 매물 비교로 5분 만에 이해하기. 모든 주식 사이트의 첫 번째 숫자.",
        "category_code": "A",
        "video_path": "/static/videos/self_A01_PER.mp4",
        "thumbnail": None,
        "playtime_minutes": 8,
        "producing_yr": "2026",
        "tags": ["PER", "주가수익비율", "재무지표", "입문"],
        "learning_objectives": [
            "PER의 정의와 계산법 (주가 ÷ 주당순이익)",
            "PER 해석법: 높으면/낮으면의 의미",
            "업종별 PER 차이 (같은 업종끼리 비교의 중요성)",
            "PER의 한계 (일회성 이익, 적자 기업, 코리아 디스카운트)",
        ],
    },

    # ─── 입문 2편: 손익계산서 ───
    {
        "contents_slno": "self_B01",
        "title": "[입문 2편] 손익계산서 기초 - 회사가 돈을 어떻게 버는지 한눈에",
        "summary": "분식집 가계부로 손익계산서 구조 5분 정리. 매출에서 순이익까지 폭포수 흐름.",
        "category_code": "B",
        "video_path": "/static/videos/self_B01_income_statement.mp4",
        "thumbnail": None,
        "playtime_minutes": 8,
        "producing_yr": "2026",
        "tags": ["손익계산서", "재무제표", "영업이익", "입문"],
        "learning_objectives": [
            "손익계산서 5단계 흐름 (매출 → 영업이익 → 순이익)",
            "영업이익이 가장 중요한 이유",
            "영업이익률의 업종별 차이 (이마트 2% vs 카카오 30%)",
            "좋은 손익계산서의 5가지 조건",
        ],
    },

    # ─── 입문 3편: 강세장 vs 약세장 ───
    {
        "contents_slno": "self_C04",
        "title": "[입문 3편] 강세장 vs 약세장 - 황소와 곰의 비밀",
        "summary": "황소(Bull)와 곰(Bear)의 비밀. 시장 사이클을 사파리 탐험가가 풀어드립니다.",
        "category_code": "C",
        "video_path": "/static/videos/self_C04_bull_bear.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["강세장", "약세장", "시장사이클", "Bull", "Bear"],
        "learning_objectives": [
            "강세장과 약세장의 정의 (각각 +20%/-20% 기준)",
            "한국과 미국의 강세장/약세장 사례",
            "약세장에서 투자자가 알아야 할 핵심 원칙",
        ],
    },

    # ─── 입문 4편: 분산투자 ───
    {
        "contents_slno": "self_D01",
        "title": "[입문 4편] 분산투자 - 계란을 한 바구니에 담지 마라",
        "summary": "한 종목 몰빵의 위험과 분산투자의 4가지 차원. ETF로 시작하는 가장 쉬운 분산.",
        "category_code": "D",
        "video_path": "/static/videos/self_D01_diversification.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["분산투자", "위험관리", "자산배분", "ETF", "입문"],
        "learning_objectives": [
            "분산투자가 필요한 이유 (코로나 항공주 사례)",
            "분산의 4가지 차원: 종목 / 업종 / 자산 / 지역",
            "ETF 1주로도 자동 분산 가능",
            "분산의 한계 (시장 전체 위험은 못 막음)",
        ],
    },

    # ─── 입문 5편: 실적 발표 뉴스 ───
    {
        "contents_slno": "self_E01",
        "title": "[입문 5편] 실적 발표 뉴스 읽는 법 - 어닝 서프라이즈/쇼크",
        "summary": "시험 점수 비유로 컨센서스 이해. 호실적인데 주가가 빠지는 이유 5분 정리.",
        "category_code": "E",
        "video_path": "/static/videos/self_E01_earnings_news.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["실적발표", "컨센서스", "어닝시즌", "뉴스해석", "입문"],
        "learning_objectives": [
            "컨센서스(애널리스트 예측 평균)의 의미",
            "어닝 서프라이즈 vs 어닝 쇼크 기준",
            "실적 뉴스 5단계 읽기 (절대수치 → YoY → QoQ → 컨센서스 → 가이던스)",
            "가이던스(미래 전망)가 가장 중요한 이유",
        ],
    },

    
]


def get_categories():
    """카테고리 목록 반환"""
    return SELF_CATEGORIES


def get_all_contents():
    """전체 자체 콘텐츠 반환"""
    return SELF_CONTENTS


def get_content_by_slno(slno: str):
    """단일 자체 콘텐츠 조회"""
    for c in SELF_CONTENTS:
        if c["contents_slno"] == slno:
            return c
    return None


def get_contents_by_category(category_code: str):
    """카테고리별 콘텐츠 조회"""
    return [c for c in SELF_CONTENTS if c.get("category_code") == category_code]


def is_self_content(slno: str) -> bool:
    """slno가 자체 콘텐츠인지 판별"""
    return str(slno).startswith("self_")
