"""
SafeInvest AI 자체 제작 콘텐츠 (✨ 기본기 탭).

학습경로/교육센터와 완전 분리되어 별도 탭으로 노출됨.
저작권: SafeInvest AI 소유 (자체 제작).

콘텐츠 구성 (총 21편) - 4단계 커리큘럼:
  🌱 1단계: 투자 첫걸음 (입문) - 4편
     F01, G01, G02, F05
  🌿 2단계: 종목 보는 눈 (초급) - 5편
     A01, A02, A03, B01, F02
  🌳 3단계: 시장 흐름 읽기 (중급) - 5편
     C04, C01, C05, E01, E02
  🍀 4단계: 안전한 투자자 되기 (고급/필수) - 7편
     D01, F04, F03, D02⚠️, D03⚠️, D04⚠️, G05⚠️
"""

# ────────────────────────────────────────
# 7개 카테고리 정의 (G 카테고리 추가)
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
        "description": "코스피/코스닥, 강세장/약세장, 금리·환율·인플레",
    },
    {
        "code": "D",
        "name": "투자 원칙",
        "icon": "🎯",
        "description": "분산투자와 ⚠️ 위험한 투자 습관(빚투/몰빵/단타) 경고",
    },
    {
        "code": "E",
        "name": "뉴스 해석",
        "icon": "📰",
        "description": "실적 발표, FOMC, 공시 읽는 법",
    },
    {
        "code": "F",
        "name": "통합 가이드",
        "icon": "🗺️",
        "description": "주식 투자 5편으로 시작하기 - 종합 가이드",
    },
    {
        "code": "G",
        "name": "실전 입문",
        "icon": "🛠️",
        "description": "증권계좌 개설, 주문 방법, ⚠️ 사기 예방까지",
    },
]


# ────────────────────────────────────────
# 학습 단계 정의 (4단계 커리큘럼)
# ────────────────────────────────────────
SELF_LEVELS = [
    {
        "code": "L1",
        "name": "1단계: 투자 첫걸음",
        "icon": "🌱",
        "description": "투자를 왜 시작해야 하는지, 어떻게 시작하는지",
    },
    {
        "code": "L2",
        "name": "2단계: 종목 보는 눈",
        "icon": "🌿",
        "description": "종목을 분석하는 기본 지표와 재무제표 읽기",
    },
    {
        "code": "L3",
        "name": "3단계: 시장 흐름 읽기",
        "icon": "🌳",
        "description": "시장 전체와 거시경제 흐름 이해",
    },
    {
        "code": "L4",
        "name": "4단계: 안전한 투자자",
        "icon": "🍀",
        "description": "위험 관리와 ⚠️ 피해야 할 투자 습관",
    },
]


# ────────────────────────────────────────
# 자체 콘텐츠 목록 (총 21편) - 학습 단계순 정렬
# ────────────────────────────────────────
# 추가 시 영상을 static/videos/ 폴더에 넣고 아래 리스트에 항목 추가.
SELF_CONTENTS = [
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 🌱 1단계: 투자 첫걸음 (입문) - 4편
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ─── 1단계 1편: 왜 투자하나 ───
    {
        "contents_slno": "self_F01",
        "title": "[1단계-1] 내 돈이 일하게 만드는 법 - 주식 투자, 왜 시작해야 하나",
        "summary": "예금 vs 주식의 본질적 차이. 복리의 마법(72의 법칙)으로 30년 후 차이가 폭발적인 이유.",
        "category_code": "F",
        "level_code": "L1",
        "order": 1,
        "video_path": "/static/videos/self_F01_why_invest.mp4",
        "thumbnail": None,
        "playtime_minutes": 8,
        "producing_yr": "2026",
        "tags": ["주식의본질", "복리", "노동소득", "자산소득", "통합가이드"],
        "is_warning": False,
        "learning_objectives": [
            "노동 소득 vs 자산 소득의 차이",
            "예금(채권자) vs 주식(주주)의 본질적 차이",
            "복리의 마법과 72의 법칙",
            "인플레이션이 예금을 갉아먹는 이유",
            "투자 시작 전 마음의 준비 3가지",
        ],
    },

    # ─── 1단계 2편: 증권계좌 만들기 ───
    {
        "contents_slno": "self_G01",
        "title": "[1단계-2] 증권계좌 만들기 - 투자의 첫 단추",
        "summary": "증권계좌는 무엇이고 어떻게 만드는가. 수수료·앱 편의성·해외주식 비교 가이드.",
        "category_code": "G",
        "level_code": "L1",
        "order": 2,
        "video_path": "/static/videos/self_G01_first_account.mp4",
        "thumbnail": None,
        "playtime_minutes": 6,
        "producing_yr": "2026",
        "tags": ["증권계좌", "비대면개설", "실전입문", "수수료"],
        "is_warning": False,
        "learning_objectives": [
            "증권계좌와 은행계좌의 차이",
            "증권사 선택 3가지 기준 (수수료·MTS·해외주식)",
            "비대면 계좌 개설 절차 (10분)",
            "본인 명의 거래의 중요성 (차명거래 금지)",
            "첫 입금과 매수 시 주의사항",
        ],
    },

    # ─── 1단계 3편: 주문 방법 ───
    {
        "contents_slno": "self_G02",
        "title": "[1단계-3] 주문 방법 - 시장가, 지정가, 예약주문",
        "summary": "주문 방식 3가지 차이와 사용법. 초보자에게 권장되는 지정가 중심으로 정리.",
        "category_code": "G",
        "level_code": "L1",
        "order": 3,
        "video_path": "/static/videos/self_G02_order_types.mp4",
        "thumbnail": None,
        "playtime_minutes": 6,
        "producing_yr": "2026",
        "tags": ["시장가", "지정가", "예약주문", "주문방법", "실전입문"],
        "is_warning": False,
        "learning_objectives": [
            "시장가 주문의 장단점 (즉시 체결 vs 슬리피지)",
            "지정가 주문이 초보자에게 권장되는 이유",
            "예약주문 활용법 (직장인 필수)",
            "주문 전 체크리스트 (종목명·매수매도·수량)",
        ],
    },

    # ─── 1단계 4편: 투자 심리 ───
    {
        "contents_slno": "self_F05",
        "title": "[1단계-4] 가장 큰 적은 나 자신 - 투자 심리학",
        "summary": "주가 변동에 따른 심리 곡선. 손실 회피, 확증 편향, FOMO 등 5가지 핵심 편향.",
        "category_code": "F",
        "level_code": "L1",
        "order": 4,
        "video_path": "/static/videos/self_F05_psychology.mp4",
        "thumbnail": None,
        "playtime_minutes": 11,
        "producing_yr": "2026",
        "tags": ["투자심리", "손실회피", "확증편향", "FOMO", "마인드셋", "통합가이드"],
        "is_warning": False,
        "learning_objectives": [
            "투자자 심리 곡선 (의심→환희→공포→절망)",
            "손실 회피 편향: 이익은 짧게, 손실은 길게",
            "확증 편향과 FOMO의 함정",
            "자기 자신을 이기는 5가지 원칙",
            "매매 원칙 미리 정해두기",
        ],
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 🌿 2단계: 종목 보는 눈 (초급) - 5편
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ─── 2단계 1편: PER ───
    {
        "contents_slno": "self_A01",
        "title": "[2단계-1] PER - 주식이 비싼지 싼지 알려주는 첫 번째 숫자",
        "summary": "PER이 뭔지 카페 매물 비교로 5분 만에 이해하기. 모든 주식 사이트의 첫 번째 숫자.",
        "category_code": "A",
        "level_code": "L2",
        "order": 1,
        "video_path": "/static/videos/self_A01_PER.mp4",
        "thumbnail": None,
        "playtime_minutes": 8,
        "producing_yr": "2026",
        "tags": ["PER", "주가수익비율", "재무지표", "입문"],
        "is_warning": False,
        "learning_objectives": [
            "PER의 정의와 계산법 (주가 ÷ 주당순이익)",
            "PER 해석법: 높으면/낮으면의 의미",
            "업종별 PER 차이 (같은 업종끼리 비교의 중요성)",
            "PER의 한계 (일회성 이익, 적자 기업, 코리아 디스카운트)",
        ],
    },

    # ─── 2단계 2편: 가치평가 3종세트 ───
    {
        "contents_slno": "self_A02",
        "title": "[2단계-2] 가치평가 3종세트 - PER·PBR·PEG",
        "summary": "PER 한 가지로는 부족하다. PBR, PEG와 함께 보는 진짜 가치평가법.",
        "category_code": "A",
        "level_code": "L2",
        "order": 2,
        "video_path": "/static/videos/self_A02_valuation_trio.mp4",
        "thumbnail": None,
        "playtime_minutes": 7,
        "producing_yr": "2026",
        "tags": ["PER", "PBR", "PEG", "가치평가", "재무지표"],
        "is_warning": False,
        "learning_objectives": [
            "PBR이 PER을 보완하는 이유 (적자 기업·자산형 업종)",
            "PEG로 성장기업 평가하기 (피터 린치 기준)",
            "업종별 가중치 다르게 적용하기",
            "같은 업종 내 비교의 중요성",
        ],
    },

    # ─── 2단계 3편: 수익성 지표 ───
    {
        "contents_slno": "self_A03",
        "title": "[2단계-3] 수익성 지표 - ROE·ROA·EPS",
        "summary": "회사가 얼마나 효율적으로 돈을 버는지. 워런 버핏의 ROE 15% 기준 포함.",
        "category_code": "A",
        "level_code": "L2",
        "order": 3,
        "video_path": "/static/videos/self_A03_profitability.mp4",
        "thumbnail": None,
        "playtime_minutes": 7,
        "producing_yr": "2026",
        "tags": ["ROE", "ROA", "EPS", "수익성", "재무지표"],
        "is_warning": False,
        "learning_objectives": [
            "ROE: 자기자본 대비 이익률 (워런 버핏 15% 기준)",
            "ROA: 빚 효과 걷어낸 진짜 운용 능력",
            "EPS: 주당순이익과 PER의 관계",
            "3~5년 추세로 봐야 의미가 있는 이유",
        ],
    },

    # ─── 2단계 4편: 손익계산서 ───
    {
        "contents_slno": "self_B01",
        "title": "[2단계-4] 손익계산서 기초 - 회사가 돈을 어떻게 버는지 한눈에",
        "summary": "분식집 가계부로 손익계산서 구조 5분 정리. 매출에서 순이익까지 폭포수 흐름.",
        "category_code": "B",
        "level_code": "L2",
        "order": 4,
        "video_path": "/static/videos/self_B01_income_statement.mp4",
        "thumbnail": None,
        "playtime_minutes": 8,
        "producing_yr": "2026",
        "tags": ["손익계산서", "재무제표", "영업이익", "입문"],
        "is_warning": False,
        "learning_objectives": [
            "손익계산서 5단계 흐름 (매출 → 영업이익 → 순이익)",
            "영업이익이 가장 중요한 이유",
            "영업이익률의 업종별 차이 (이마트 2% vs 카카오 30%)",
            "좋은 손익계산서의 5가지 조건",
        ],
    },

    # ─── 2단계 5편: 좋은 회사 찾기 ───
    {
        "contents_slno": "self_F02",
        "title": "[2단계-5] 좋은 회사를 찾는 돋보기 - 재무제표 3가지 핵심 지표",
        "summary": "맛집 인수 비유로 회사 분석. 매출/영업이익/부채비율 3가지로 좋은 회사 80% 판단.",
        "category_code": "F",
        "level_code": "L2",
        "order": 5,
        "video_path": "/static/videos/self_F02_finding_good_company.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["회사분석", "재무제표", "매출", "영업이익", "부채비율", "통합가이드"],
        "is_warning": False,
        "learning_objectives": [
            "좋은 회사 판단 3가지 핵심 지표",
            "매출 성장 패턴 읽기",
            "영업이익률의 의미 (본업의 실력)",
            "부채비율 적정 수준 (업종별 차이)",
            "DART와 네이버 증권 활용법",
        ],
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 🌳 3단계: 시장 흐름 읽기 (중급) - 5편
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ─── 3단계 1편: 강세장 vs 약세장 ───
    {
        "contents_slno": "self_C04",
        "title": "[3단계-1] 강세장 vs 약세장 - 황소와 곰의 비밀",
        "summary": "황소(Bull)와 곰(Bear)의 비밀. 시장 사이클을 사파리 탐험가가 풀어드립니다.",
        "category_code": "C",
        "level_code": "L3",
        "order": 1,
        "video_path": "/static/videos/self_C04_bull_bear.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["강세장", "약세장", "시장사이클", "Bull", "Bear"],
        "is_warning": False,
        "learning_objectives": [
            "강세장과 약세장의 정의 (각각 +20%/-20% 기준)",
            "한국과 미국의 강세장/약세장 사례",
            "약세장에서 투자자가 알아야 할 핵심 원칙",
        ],
    },

    # ─── 3단계 2편: 코스피 vs 코스닥 ───
    {
        "contents_slno": "self_C01",
        "title": "[3단계-2] 코스피 vs 코스닥 - 어디서 시작할까",
        "summary": "두 시장의 성격 차이와 위험. 초보자가 어디서 시작해야 안전한지.",
        "category_code": "C",
        "level_code": "L3",
        "order": 2,
        "video_path": "/static/videos/self_C01_kospi_kosdaq.mp4",
        "thumbnail": None,
        "playtime_minutes": 6,
        "producing_yr": "2026",
        "tags": ["코스피", "코스닥", "시장구조", "상장폐지", "관리종목"],
        "is_warning": False,
        "learning_objectives": [
            "코스피·코스닥 상장 기준과 변동성 차이",
            "관리종목·상장폐지 위험 (코스닥에서 더 큼)",
            "초보자가 코스피 대형주부터 시작하는 게 좋은 이유",
            "코스닥 투자 시 재무 상태 점검 포인트",
        ],
    },

    # ─── 3단계 3편: 금리·환율·인플레 ───
    {
        "contents_slno": "self_C05",
        "title": "[3단계-3] 금리·환율·인플레이션 - 시장을 흔드는 3대 변수",
        "summary": "회사 밖 거시경제 변수. 세 변수가 어떻게 얽혀 주식시장을 움직이는지.",
        "category_code": "C",
        "level_code": "L3",
        "order": 3,
        "video_path": "/static/videos/self_C05_macro_basics.mp4",
        "thumbnail": None,
        "playtime_minutes": 7,
        "producing_yr": "2026",
        "tags": ["금리", "환율", "인플레이션", "거시경제", "CPI"],
        "is_warning": False,
        "learning_objectives": [
            "금리 인상이 주식시장에 부정적인 3가지 이유",
            "환율 상승이 수출/수입 기업에 미치는 정반대 영향",
            "인플레이션과 금리·CPI의 관계",
            "세 변수가 서로 얽혀 움직이는 메커니즘",
        ],
    },

    # ─── 3단계 4편: 실적 발표 뉴스 ───
    {
        "contents_slno": "self_E01",
        "title": "[3단계-4] 실적 발표 뉴스 읽는 법 - 어닝 서프라이즈/쇼크",
        "summary": "시험 점수 비유로 컨센서스 이해. 호실적인데 주가가 빠지는 이유 5분 정리.",
        "category_code": "E",
        "level_code": "L3",
        "order": 4,
        "video_path": "/static/videos/self_E01_earnings_news.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["실적발표", "컨센서스", "어닝시즌", "뉴스해석", "입문"],
        "is_warning": False,
        "learning_objectives": [
            "컨센서스(애널리스트 예측 평균)의 의미",
            "어닝 서프라이즈 vs 어닝 쇼크 기준",
            "실적 뉴스 5단계 읽기 (절대수치 → YoY → QoQ → 컨센서스 → 가이던스)",
            "가이던스(미래 전망)가 가장 중요한 이유",
        ],
    },

    # ─── 3단계 5편: FOMC ───
    {
        "contents_slno": "self_E02",
        "title": "[3단계-5] FOMC 이해하기 - 미국 금리가 왜 한국 주식에 영향을 줄까",
        "summary": "FOMC가 무엇이고, 왜 새벽 발표가 한국 시장을 흔드는지 한 번에 정리.",
        "category_code": "E",
        "level_code": "L3",
        "order": 5,
        "video_path": "/static/videos/self_E02_fomc.mp4",
        "thumbnail": None,
        "playtime_minutes": 6,
        "producing_yr": "2026",
        "tags": ["FOMC", "연준", "기준금리", "점도표", "뉴스해석"],
        "is_warning": False,
        "learning_objectives": [
            "FOMC와 연준의 역할 (1년 8회 회의)",
            "미국 금리가 한국 주식에 영향 주는 2가지 경로",
            "발표에서 봐야 할 3가지 (결정·점도표·의장 발언)",
            "FOMC 변동성에 휘말리지 않는 자세",
        ],
    },

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 🍀 4단계: 안전한 투자자 되기 (고급/필수) - 7편
    # ⚠️ 표시는 SafeInvest AI 핵심 차별점
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    # ─── 4단계 1편: 분산투자 ───
    {
        "contents_slno": "self_D01",
        "title": "[4단계-1] 분산투자 - 계란을 한 바구니에 담지 마라",
        "summary": "한 종목 몰빵의 위험과 분산투자의 4가지 차원. ETF로 시작하는 가장 쉬운 분산.",
        "category_code": "D",
        "level_code": "L4",
        "order": 1,
        "video_path": "/static/videos/self_D01_diversification.mp4",
        "thumbnail": None,
        "playtime_minutes": 9,
        "producing_yr": "2026",
        "tags": ["분산투자", "위험관리", "자산배분", "ETF", "입문"],
        "is_warning": False,
        "learning_objectives": [
            "분산투자가 필요한 이유 (코로나 항공주 사례)",
            "분산의 4가지 차원: 종목 / 업종 / 자산 / 지역",
            "ETF 1주로도 자동 분산 가능",
            "분산의 한계 (시장 전체 위험은 못 막음)",
        ],
    },

    # ─── 4단계 2편: 포트폴리오 ───
    {
        "contents_slno": "self_F04",
        "title": "[4단계-2] 계란을 한 바구니에 담지 않는 기술 - 포트폴리오와 분산",
        "summary": "코로나 폭락기 3명의 다른 결과. 종목/섹터/자산 3차원 분산과 상관관계의 비밀.",
        "category_code": "F",
        "level_code": "L4",
        "order": 2,
        "video_path": "/static/videos/self_F04_portfolio.mp4",
        "thumbnail": None,
        "playtime_minutes": 10,
        "producing_yr": "2026",
        "tags": ["포트폴리오", "분산투자", "자산배분", "상관관계", "리밸런싱", "통합가이드"],
        "is_warning": False,
        "learning_objectives": [
            "분산의 3가지 차원: 종목/섹터/자산",
            "상관관계가 분산 효과의 핵심인 이유",
            "한국 주요 섹터와 분산 가이드",
            "나이별 자산 배분 비율",
            "리밸런싱과 ETF 활용법",
        ],
    },

    # ─── 4단계 3편: 차트의 오해와 진실 ───
    {
        "contents_slno": "self_F03",
        "title": "[4단계-3] 차트는 미래를 보여주는 거울일까? - 기술적 분석 기초",
        "summary": "차트는 점술 도구가 아니라 군중 심리의 기록. 캔들/이동평균선/거래량 3가지만 알면 80%.",
        "category_code": "F",
        "level_code": "L4",
        "order": 3,
        "video_path": "/static/videos/self_F03_chart_basics.mp4",
        "thumbnail": None,
        "playtime_minutes": 10,
        "producing_yr": "2026",
        "tags": ["차트분석", "캔들", "이동평균선", "거래량", "기술적분석", "통합가이드"],
        "is_warning": False,
        "learning_objectives": [
            "캔들 차트 보는 법 (양봉/음봉)",
            "이동평균선과 정배열/역배열의 의미",
            "거래량이 가격보다 정직한 이유",
            "차트의 한계 (미래 예측 X, 펀더멘털 못 이김)",
            "차트가 정말 도움 되는 경우 (과열 회피, 손절 기준)",
        ],
    },

    # ─── 4단계 4편: ⚠️ 빚투의 위험 ───
    {
        "contents_slno": "self_D02",
        "title": "[4단계-4] ⚠️ 빚투의 위험 - 신용·미수가 왜 위험한가",
        "summary": "레버리지가 키우는 손실, 반대매매의 결정타, 그리고 빚투가 판단력을 흐리는 이유.",
        "category_code": "D",
        "level_code": "L4",
        "order": 4,
        "video_path": "/static/videos/self_D02_warning_leverage.mp4",
        "thumbnail": None,
        "playtime_minutes": 7,
        "producing_yr": "2026",
        "tags": ["빚투", "신용거래", "미수거래", "반대매매", "레버리지", "경고"],
        "is_warning": True,
        "learning_objectives": [
            "신용·미수거래의 구조와 레버리지 효과",
            "반대매매가 가장 안 좋은 가격에 발동되는 이유",
            "이자 부담과 심리적 압박이 판단력 흐리는 원리",
            "초보자가 1~2년 자기 돈으로 시작해야 하는 이유",
        ],
    },

    # ─── 4단계 5편: ⚠️ 몰빵·테마주 ───
    {
        "contents_slno": "self_D03",
        "title": "[4단계-5] ⚠️ 몰빵·테마주 추격매수의 위험",
        "summary": "큰 손실 후 회복 불가능한 수치, 테마주 가격 형성 구조, FOMO와 추격매수의 함정.",
        "category_code": "D",
        "level_code": "L4",
        "order": 5,
        "video_path": "/static/videos/self_D03_warning_concentration.mp4",
        "thumbnail": None,
        "playtime_minutes": 7,
        "producing_yr": "2026",
        "tags": ["몰빵투자", "테마주", "추격매수", "FOMO", "경고"],
        "is_warning": True,
        "learning_objectives": [
            "큰 손실 후 회복에 필요한 수익률 (50% 손실 → 100% 필요)",
            "테마주가 실적이 아닌 기대로 형성되는 구조",
            "추격매수가 통계적으로 가장 비싼 시점인 이유",
            "매수 전 회사 검증 4가지 질문",
        ],
    },

    # ─── 4단계 6편: ⚠️ 단타의 함정 ───
    {
        "contents_slno": "self_D04",
        "title": "[4단계-6] ⚠️ 단타의 함정 - 왜 초보자에게 불리한가",
        "summary": "거래비용·정보 비대칭·심리·삶의 질 4가지 측면에서 단타가 구조적으로 불리한 이유.",
        "category_code": "D",
        "level_code": "L4",
        "order": 6,
        "video_path": "/static/videos/self_D04_warning_daytrading.mp4",
        "thumbnail": None,
        "playtime_minutes": 7,
        "producing_yr": "2026",
        "tags": ["단타", "데이트레이딩", "거래비용", "손실회피편향", "경고"],
        "is_warning": True,
        "learning_objectives": [
            "왕복 거래비용이 누적되어 수익을 갉아먹는 구조",
            "기관·외국인과의 정보·속도 격차",
            "사람의 본능(빠른 익절·늦은 손절)이 단타에 불리한 이유",
            "단타가 본업과 삶의 질에 미치는 영향",
        ],
    },

    # ─── 4단계 7편: ⚠️ 리딩방 사기 ───
    {
        "contents_slno": "self_G05",
        "title": "[4단계-7] ⚠️ 리딩방 사기 - 종목 추천의 함정",
        "summary": "리딩방의 작동 구조와 흔한 사기 패턴. 금감원 '파인'에서 정식 등록 확인하는 법.",
        "category_code": "G",
        "level_code": "L4",
        "order": 7,
        "video_path": "/static/videos/self_G05_scam_warning.mp4",
        "thumbnail": None,
        "playtime_minutes": 7,
        "producing_yr": "2026",
        "tags": ["리딩방", "투자사기", "시세조종", "무인가투자자문", "금감원파인", "경고"],
        "is_warning": True,
        "learning_objectives": [
            "리딩방의 무료→유료 유도 구조",
            "시세조종과 무인가 투자자문업의 차이",
            "흔한 사기 패턴 5가지 (전문가 포장·수익률 자랑·조급함 유발·점진적 요구·책임 전가)",
            "금감원 '파인'에서 정식 업체 확인하는 법",
            "피해 발생 시 신고 절차",
        ],
    },
]


# ────────────────────────────────────────
# 조회 함수들
# ────────────────────────────────────────
def get_categories():
    """카테고리 목록 반환"""
    return SELF_CATEGORIES


def get_levels():
    """학습 단계 목록 반환"""
    return SELF_LEVELS


def get_all_contents():
    """전체 자체 콘텐츠 반환 (학습 단계순 정렬)"""
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


def get_contents_by_level(level_code: str):
    """학습 단계별 콘텐츠 조회 (order 순서대로)"""
    contents = [c for c in SELF_CONTENTS if c.get("level_code") == level_code]
    return sorted(contents, key=lambda x: x.get("order", 999))


def get_warning_contents():
    """⚠️ 경고 콘텐츠만 조회 (SafeInvest AI 핵심 차별점)"""
    return [c for c in SELF_CONTENTS if c.get("is_warning") is True]


def get_contents_grouped_by_level():
    """학습 단계별로 그룹화된 콘텐츠 반환 (프론트엔드 렌더링용)"""
    result = []
    for level in SELF_LEVELS:
        level_contents = get_contents_by_level(level["code"])
        result.append({
            **level,
            "contents": level_contents,
            "total_count": len(level_contents),
        })
    return result


def is_self_content(slno: str) -> bool:
    """slno가 자체 콘텐츠인지 판별"""
    return str(slno).startswith("self_")
