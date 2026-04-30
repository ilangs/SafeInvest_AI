"""
학습 경로 정의 - SafeInvest AI v2.10

설계 원칙:
  - 사용자의 인생 단계(life stage) + 지금 고민에 기반한 9개 코스
  - 각 학습경로는 명확한 타겟(target_audience: 금감원 교육대상 코드)을 가짐
  - 주차마다 theme/learning_goals/풀(topic_pools.py 참조) 매핑

타겟 코드 (eduTrgtCntnt):
  C 아동기 / H 청소년기 / Y 청년기 / A 중장년기 / R 노년기
  U 대학생 / AM 군장병 / F 신용유의자
  D 장애인 / M 다문화가정 / N 북한이탈주민 / P 학부모 / T 교사

이 파일은 정의만 담당. 콘텐츠 매칭은 app/curriculum_matcher.py 참조.
"""
from typing import Optional


# ============================================================
# 9개 학습경로 정의
# ============================================================
LEARNING_PATHS = [

    # ────────────────────────────────────────────────
    # ① 청소년 금융 첫걸음 (4주)
    # ────────────────────────────────────────────────
    {
        "id": "teen_first_finance_4w",
        "name": "🎒 청소년 금융 첫걸음",
        "subtitle": "용돈부터 시작하는 똑똑한 돈 관리",
        "tone": "재미·쉽게",
        "target_audience": ["H", "C"],
        "target_level": "beginner",
        "target_goals": ["financial_literacy"],
        "target_age_range": [10, 18],
        "duration_weeks": 4,
        "weekly_hours": 1,
        "total_contents": 12,
        "milestones": [
            {"week": 2, "badge": "용돈 마스터"},
            {"week": 4, "badge": "사기 방지 수료"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "용돈, 어떻게 쓸까?",
             "description": "수입과 지출의 개념을 이해하고 용돈 관리의 기초를 배웁니다.",
             "learning_goals": ["수입·지출 구분", "용돈 기록 습관", "저축의 의미"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 2, "theme": "처음 만나는 은행과 통장",
             "description": "통장을 만들고 저축을 시작하는 방법을 배웁니다.",
             "learning_goals": ["통장 개설", "예금·적금 차이", "이자의 개념"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 3, "theme": "카드와 결제, 안전하게 쓰기",
             "description": "청소년이 만날 수 있는 결제수단과 주의점을 익힙니다.",
             "learning_goals": ["체크카드 vs 신용카드", "간편결제 안전수칙"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 4, "theme": "금융사기 안 당하기",
             "description": "청소년 대상 사기 수법과 대응법을 배웁니다.",
             "learning_goals": ["보이스피싱 대처", "스미싱 식별", "가족 사칭 사기"],
             "content_slnos": [], "expected_minutes": 30},
        ],
    },

    # ────────────────────────────────────────────────
    # ② 대학생·취업준비 코스 (4주)
    # ────────────────────────────────────────────────
    {
        "id": "college_career_prep_4w",
        "name": "🎓 대학생·취업준비 코스",
        "subtitle": "통장부터 첫 투자까지, 재테크의 시작",
        "tone": "친근·격려",
        "target_audience": ["U", "Y"],
        "target_level": "beginner",
        "target_goals": ["investment_start", "financial_safety"],
        "target_age_range": [19, 27],
        "duration_weeks": 4,
        "weekly_hours": 2,
        "total_contents": 12,
        "milestones": [
            {"week": 2, "badge": "신용 입문"},
            {"week": 4, "badge": "투자 첫걸음"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "첫 월급 받기 전 준비",
             "description": "통장 만들고 신용 점수 시작하기.",
             "learning_goals": ["청년 우대 통장", "체크카드", "신용 점수의 시작"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 2, "theme": "학자금과 청년 대출",
             "description": "학자금 대출 똑똑하게 받고 갚는 방법.",
             "learning_goals": ["학자금 대출 종류", "상환 전략", "청년 우대 상품"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 3, "theme": "작은 돈으로 시작하는 투자",
             "description": "소액으로 배우는 투자 입문.",
             "learning_goals": ["주식 vs ETF", "소액 투자 시작", "위험과 수익"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 4, "theme": "취업·창업 준비 자금",
             "description": "첫 사회 진출을 위한 자금 계획.",
             "learning_goals": ["비상금 만들기", "면접·이직 자금", "청년 창업 지원"],
             "content_slnos": [], "expected_minutes": 50},
        ],
    },

    # ────────────────────────────────────────────────
    # ③ 사회초년생 첫 1년 가이드 (6주)
    # ────────────────────────────────────────────────
    {
        "id": "rookie_first_year_6w",
        "name": "💼 사회초년생 첫 1년 가이드",
        "subtitle": "첫 월급의 막막함을 자신감으로",
        "tone": "친근·격려",
        "target_audience": ["Y"],
        "target_level": "beginner",
        "target_goals": ["wealth_building", "investment_start"],
        "target_age_range": [22, 32],
        "duration_weeks": 6,
        "weekly_hours": 2,
        "total_contents": 18,
        "milestones": [
            {"week": 2, "badge": "통장 마스터"},
            {"week": 4, "badge": "주거 준비"},
            {"week": 6, "badge": "투자 첫걸음"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "첫 월급, 어디로 보낼까",
             "description": "월급 통장 분리하고 자동이체 설정하기.",
             "learning_goals": ["월급 흐름 설계", "통장 쪼개기", "자동이체"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 2, "theme": "비상금부터 만들자",
             "description": "갑작스런 지출에 대비하는 6개월치 생활비.",
             "learning_goals": ["비상금 규모 계산", "파킹통장 활용", "적금 시작"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 3, "theme": "신용카드와 신용점수",
             "description": "신용카드 똑똑하게 쓰고 신용 쌓기.",
             "learning_goals": ["신용카드 vs 체크카드", "신용점수 관리", "연체 위험"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 4, "theme": "청약과 주거 자금 준비",
             "description": "내 집 마련의 첫 단추, 청약통장.",
             "learning_goals": ["주택청약 종합저축", "청년우대형", "전월세 자금"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 5, "theme": "시작하는 투자, ETF로 첫발",
             "description": "월급의 일부를 투자에 배분하기.",
             "learning_goals": ["자산 배분 기초", "ETF 입문", "분산투자 원리"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 6, "theme": "직장인이 만날 수 있는 사기",
             "description": "신입사원을 노리는 사기 수법과 대응.",
             "learning_goals": ["투자사기", "보이스피싱", "명의도용 예방"],
             "content_slnos": [], "expected_minutes": 40},
        ],
    },

    # ────────────────────────────────────────────────
    # ④ 본격 재테크 8주 코스
    # ────────────────────────────────────────────────
    {
        "id": "wealth_building_8w",
        "name": "📈 본격 재테크 8주 코스",
        "subtitle": "예금만 했던 당신의 체계적 투자 첫걸음",
        "tone": "명확·실용",
        "target_audience": ["Y", "A"],
        "target_level": "intermediate",
        "target_goals": ["wealth_building", "investment_start"],
        "target_age_range": [28, 55],
        "duration_weeks": 8,
        "weekly_hours": 2,
        "total_contents": 24,
        "milestones": [
            {"week": 2, "badge": "위험 이해"},
            {"week": 4, "badge": "ETF 마스터"},
            {"week": 6, "badge": "절세 활용"},
            {"week": 8, "badge": "투자 원칙 수립"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "재테크의 시작은 마인드부터",
             "description": "예금만으로는 부족한 이유와 투자가 필요한 이유.",
             "learning_goals": ["인플레이션과 실질수익", "복리의 힘", "재무목표"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 2, "theme": "위험과 수익, 진짜 관계",
             "description": "위험을 알아야 수익을 얻는다.",
             "learning_goals": ["변동성과 리스크 구분", "안전자산 vs 위험자산", "본인 위험성향"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 3, "theme": "계란을 한 바구니에 담지 마라",
             "description": "분산투자의 진짜 의미.",
             "learning_goals": ["자산군 분산", "시간 분산", "지역 분산"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 4, "theme": "ETF, 가장 쉬운 투자상품",
             "description": "처음 시작하는 사람을 위한 ETF 가이드.",
             "learning_goals": ["ETF 개념", "국내·해외 ETF", "매매 방법"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 5, "theme": "펀드와 채권, 알아두기",
             "description": "ETF 외 다른 투자상품 이해.",
             "learning_goals": ["액티브 vs 패시브 펀드", "채권의 개념", "수수료 비교"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 6, "theme": "ISA로 절세하며 투자하기",
             "description": "세금 줄이는 만능 계좌, ISA.",
             "learning_goals": ["ISA 구조", "신탁형·일임형·중개형", "세제혜택"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 7, "theme": "연금으로 미래 준비하기",
             "description": "세액공제 받으며 노후도 준비.",
             "learning_goals": ["연금저축 세액공제", "IRP 활용", "인출 전략"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 8, "theme": "나만의 투자 원칙 만들기",
             "description": "8주 학습을 정리하며 원칙 세우기.",
             "learning_goals": ["자산배분 비율 결정", "리밸런싱 주기", "투자 일지"],
             "content_slnos": [], "expected_minutes": 50},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑤ 50대 노후 점검 6주
    # ────────────────────────────────────────────────
    {
        "id": "midlife_retire_check_6w",
        "name": "🌅 50대 노후 점검 6주",
        "subtitle": "막연한 노후 걱정을 구체적 계획으로",
        "tone": "차분·진지",
        "target_audience": ["A"],
        "target_level": "intermediate",
        "target_goals": ["retirement"],
        "target_age_range": [45, 60],
        "duration_weeks": 6,
        "weekly_hours": 2,
        "total_contents": 18,
        "milestones": [
            {"week": 2, "badge": "연금 이해"},
            {"week": 4, "badge": "자산 점검"},
            {"week": 6, "badge": "노후 계획 수립"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "내 노후 자금, 얼마나 부족한가",
             "description": "막연한 걱정을 구체적 숫자로.",
             "learning_goals": ["은퇴 후 필요 자금 계산", "현재 자산 진단", "부족분 파악"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 2, "theme": "3층 연금 체계 이해하기",
             "description": "국민연금·퇴직연금·개인연금의 역할.",
             "learning_goals": ["국민연금 수령액 조회", "퇴직연금 DB·DC", "개인연금 종류"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 3, "theme": "퇴직금과 IRP 활용법",
             "description": "받은 퇴직금을 어떻게 굴릴까.",
             "learning_goals": ["IRP 계좌", "일시금 vs 연금 수령", "세제 차이"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 4, "theme": "50대의 안정적 자산 배분",
             "description": "은퇴가 가까울수록 어떻게 바꿀까.",
             "learning_goals": ["주식·채권 비중 조정", "안전자산 비율", "생애주기 펀드"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 5, "theme": "보험 다시 점검하기",
             "description": "노후 의료비 리스크 대비.",
             "learning_goals": ["실손·암보험 점검", "간병보험 필요성", "보장 분석"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 6, "theme": "주거와 추가 수입원",
             "description": "주택연금과 노후 현금흐름.",
             "learning_goals": ["주택연금 활용", "부동산 다운사이징", "시니어 일자리"],
             "content_slnos": [], "expected_minutes": 60},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑥ 은퇴 후 자금 관리 4주
    # ────────────────────────────────────────────────
    {
        "id": "post_retire_4w",
        "name": "🌳 은퇴 후 자금 관리 4주",
        "subtitle": "안정적인 황금기를 위한 현금흐름 설계",
        "tone": "차분·진지",
        "target_audience": ["R"],
        "target_level": "intermediate",
        "target_goals": ["retirement", "fraud_prevention"],
        "target_age_range": [60, 85],
        "duration_weeks": 4,
        "weekly_hours": 1,
        "total_contents": 12,
        "milestones": [
            {"week": 2, "badge": "자산 보존"},
            {"week": 4, "badge": "안전한 노후"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "은퇴 자금, 얼마씩 꺼낼까",
             "description": "평생 마르지 않게 인출하는 방법.",
             "learning_goals": ["4% 인출 룰", "연금 vs 일시금", "세금 효율 인출"],
             "content_slnos": [], "expected_minutes": 40},
            {"week_number": 2, "theme": "자산을 지키는 안정적 운용",
             "description": "위험 줄이며 자산 보존하기.",
             "learning_goals": ["안전자산 비중 확대", "채권·예금 활용", "인플레이션 대응"],
             "content_slnos": [], "expected_minutes": 40},
            {"week_number": 3, "theme": "스마트폰으로 안전한 금융",
             "description": "모바일 뱅킹·간편결제 안전하게.",
             "learning_goals": ["모바일 뱅킹 기초", "보안 수칙", "자녀와 정보 공유"],
             "content_slnos": [], "expected_minutes": 40},
            {"week_number": 4, "theme": "노년층을 노리는 사기 막기",
             "description": "보이스피싱·로맨스 스캠·투자 권유.",
             "learning_goals": ["노년 대상 사기 패턴", "의심 대응법", "신고 절차"],
             "content_slnos": [], "expected_minutes": 40},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑦ 금융사기 종합 대응 4주
    # ────────────────────────────────────────────────
    {
        "id": "fraud_defense_4w",
        "name": "🛡️ 금융사기 종합 대응 4주",
        "subtitle": "보이스피싱부터 투자사기까지, 모든 사기 한 번에",
        "tone": "경각심·직설",
        "target_audience": ["Y", "A", "R"],
        "target_level": "beginner",
        "target_goals": ["fraud_prevention", "financial_safety"],
        "target_age_range": [20, 80],
        "duration_weeks": 4,
        "weekly_hours": 1,
        "total_contents": 12,
        "milestones": [
            {"week": 2, "badge": "디지털 사기 방어"},
            {"week": 4, "badge": "사기 종합 대응"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "보이스피싱 완전 정복",
             "description": "최신 수법과 즉시 판단하는 법.",
             "learning_goals": ["검찰·경찰 사칭", "가족 사칭", "즉시 대응 절차"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 2, "theme": "스미싱과 메신저 피싱",
             "description": "문자·카톡으로 오는 사기 식별하기.",
             "learning_goals": ["택배 사칭 스미싱", "URL 식별", "가족 사칭 카톡"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 3, "theme": "투자 사기와 도박 함정",
             "description": "고수익 약속에 속지 않기.",
             "learning_goals": ["리딩방 사기", "코인 사기", "영끌·빚투의 위험"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 4, "theme": "대출 사기와 일상 사기",
             "description": "불법 대출과 전세사기까지.",
             "learning_goals": ["불법 사금융 식별", "전세사기 예방", "신고 절차"],
             "content_slnos": [], "expected_minutes": 30},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑧ 군장병 자금 마련 코스 4주
    # ────────────────────────────────────────────────
    {
        "id": "military_savings_4w",
        "name": "🏃 군장병 자금 마련 코스",
        "subtitle": "18개월 안에 1,000만원 모으기",
        "tone": "명확·실용",
        "target_audience": ["AM"],
        "target_level": "beginner",
        "target_goals": ["wealth_building", "investment_start"],
        "target_age_range": [19, 28],
        "duration_weeks": 4,
        "weekly_hours": 1,
        "total_contents": 12,
        "milestones": [
            {"week": 2, "badge": "군적금 시작"},
            {"week": 4, "badge": "전역 준비"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "군 생활 시작, 통장부터 정리",
             "description": "입대 직후 자동이체와 통장 정리.",
             "learning_goals": ["봉급 통장 설정", "자동이체 정리", "청년 우대 통장"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 2, "theme": "군 월급 똑똑하게 모으기",
             "description": "적은 월급도 모으면 목돈.",
             "learning_goals": ["청년도약계좌", "군적금", "적금 추천 상품"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 3, "theme": "18개월 안에 1,000만원 모으기",
             "description": "구체적 목표와 실행 계획.",
             "learning_goals": ["목표금액·시점 계산", "예산 짜기", "수당 활용"],
             "content_slnos": [], "expected_minutes": 30},
            {"week_number": 4, "theme": "전역 후 자금 계획",
             "description": "학자금·취업 준비 자금으로 활용.",
             "learning_goals": ["전역 후 사용처", "학자금·등록금", "첫 투자 준비"],
             "content_slnos": [], "expected_minutes": 30},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑨ 빚 관리 위기 탈출 5주
    # ────────────────────────────────────────────────
    {
        "id": "debt_escape_5w",
        "name": "🆘 빚 관리 위기 탈출 5주",
        "subtitle": "빚의 늪에서 벗어나는 실전 가이드",
        "tone": "공감·희망",
        "target_audience": ["F", "Y", "A"],
        "target_level": "beginner",
        "target_goals": ["financial_safety"],
        "target_age_range": [22, 60],
        "duration_weeks": 5,
        "weekly_hours": 2,
        "total_contents": 15,
        "milestones": [
            {"week": 2, "badge": "신용 이해"},
            {"week": 4, "badge": "채무조정 학습"},
            {"week": 5, "badge": "재기 시작"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "내 빚 정확히 파악하기",
             "description": "막연한 부채를 구체적 숫자로.",
             "learning_goals": ["부채 목록 정리", "금리·잔액 파악", "신용정보 조회"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 2, "theme": "신용점수의 진실",
             "description": "점수가 떨어진 이유와 회복 원리.",
             "learning_goals": ["신용점수 산정 기준", "연체의 영향", "점수 회복 시간"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 3, "theme": "빚 정리, 어디부터?",
             "description": "갚는 순서와 효율적 방법.",
             "learning_goals": ["고금리부터 vs 소액부터", "대환대출 활용", "상환 우선순위"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 4, "theme": "채무조정제도 알아보기",
             "description": "신용회복위원회·법원 제도 활용.",
             "learning_goals": ["워크아웃·개인회생", "신청 자격", "절차와 영향"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 5, "theme": "재기를 위한 신용 다시 쌓기",
             "description": "빚을 벗어난 후 신용 재건.",
             "learning_goals": ["신용 재건 단계", "안전한 재시작", "가족 영향 관리"],
             "content_slnos": [], "expected_minutes": 50},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑩ 똑똑한 투자자의 리포트·산업 분석 5주 코스
    # ────────────────────────────────────────────────
    {
        "id": "smart_investor_report_5w",
        "name": "📊 똑똑한 투자자의 리포트·산업 분석",
        "subtitle": "증권 리포트 읽고, 산업 흐름 이해하는 진짜 투자자 되기",
        "tone": "명확·실용",
        "target_audience": ["Y", "A", "U"],
        "target_level": "intermediate",
        "target_goals": ["wealth_building", "investment_start"],
        "target_age_range": [22, 60],
        "duration_weeks": 5,
        "weekly_hours": 2,
        "total_contents": 15,
        "milestones": [
            {"week": 2, "badge": "리포트 마스터"},
            {"week": 4, "badge": "산업 분석가"},
            {"week": 5, "badge": "투자 통찰력"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "투자 용어와 기본기",
             "description": "PER·PBR부터 재무제표까지, 투자자가 꼭 알아야 할 기초 용어.",
             "learning_goals": ["주식 용어 이해", "재무제표 읽기", "주문·매매 기초"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 2, "theme": "증권사 리포트 제대로 보기",
             "description": "증권사 리포트의 구조와 핵심을 빠르게 파악하는 법.",
             "learning_goals": ["리포트 구조 이해", "목표주가 해석", "무료 리포트 활용"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 3, "theme": "산업 분석 1: K-제조업",
             "description": "반도체·2차전지·조선·전기차·방산 등 한국 주력 제조업 이해.",
             "learning_goals": ["반도체·2차전지 분석", "조선·전기차 흐름", "K-방산 경쟁력"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 4, "theme": "산업 분석 2: K-콘텐츠·서비스",
             "description": "OTT·게임·K-푸드·화장품·바이오 등 콘텐츠·서비스 산업 분석.",
             "learning_goals": ["콘텐츠·게임 산업", "K-푸드·화장품", "바이오시밀러"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 5, "theme": "투자의 역사로 배우는 교훈",
             "description": "위대한 투자자와 위기 사례에서 얻는 통찰.",
             "learning_goals": ["가치투자의 거장", "버블·금융위기 교훈", "투자 원칙"],
             "content_slnos": [], "expected_minutes": 50},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑪ 투자자의 절세 마스터 4주 코스
    # ────────────────────────────────────────────────
    {
        "id": "tax_smart_investor_4w",
        "name": "💸 투자자의 절세 마스터",
        "subtitle": "수익률보다 중요한 세후 수익률, 안 내는 게 버는 것",
        "tone": "명확·실용",
        "target_audience": ["Y", "A"],
        "target_level": "intermediate",
        "target_goals": ["wealth_building"],
        "target_age_range": [28, 60],
        "duration_weeks": 4,
        "weekly_hours": 2,
        "total_contents": 12,
        "milestones": [
            {"week": 2, "badge": "ISA 마스터"},
            {"week": 4, "badge": "절세 종합"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "금융세제 기초",
             "description": "세금이 수익률에 미치는 영향과 세후 수익률 개념.",
             "learning_goals": ["세후 수익률 이해", "펀드·ETF 과세 구조", "절세의 중요성"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 2, "theme": "절세형 금융상품 활용",
             "description": "ISA·비과세·분리과세 등 절세형 상품 활용법.",
             "learning_goals": ["ISA 활용", "비과세·분리과세 구분", "손익통산"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 3, "theme": "양도세와 종합과세",
             "description": "주식·해외주식·파생상품의 세금 체계.",
             "learning_goals": ["주식 양도소득세", "해외주식 세금", "금융소득종합과세"],
             "content_slnos": [], "expected_minutes": 60},
            {"week_number": 4, "theme": "연금·상속·증여",
             "description": "연금 인출 시 세금부터 자녀 증여까지.",
             "learning_goals": ["연금 수령 세금", "상속 vs 증여", "건보료 영향"],
             "content_slnos": [], "expected_minutes": 50},
        ],
    },

    # ────────────────────────────────────────────────
    # ⑫ 투자 첫걸음 실전 가이드 4주
    # ────────────────────────────────────────────────
    {
        "id": "investing_first_steps_4w",
        "name": "🚀 투자 첫걸음 실전 가이드",
        "subtitle": "계좌 개설부터 첫 매매까지, 따라하면 되는 실전 절차",
        "tone": "친근·실용",
        "target_audience": ["Y", "U"],
        "target_level": "beginner",
        "target_goals": ["investment_start"],
        "target_age_range": [19, 35],
        "duration_weeks": 4,
        "weekly_hours": 2,
        "total_contents": 12,
        "milestones": [
            {"week": 2, "badge": "계좌 개설 완료"},
            {"week": 4, "badge": "투자 시작 준비 완료"},
        ],
        "weeks": [
            {"week_number": 1, "theme": "시작 전, 투자 vs 투기 알기",
             "description": "투자를 시작하기 전 가장 중요한 마인드 구분.",
             "learning_goals": ["투자와 투기 차이", "본인 성향 점검", "잃지 않는 원칙"],
             "content_slnos": [], "expected_minutes": 40},
            {"week_number": 2, "theme": "계좌 만들고 앱 깔기",
             "description": "증권사 선택부터 MTS 설치까지 따라하기.",
             "learning_goals": ["비대면 계좌개설", "MTS·HTS 설치", "입출금 방법"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 3, "theme": "주식 시장 어떻게 돌아가나",
             "description": "호가, 주문, 배당 등 매매 기본.",
             "learning_goals": ["주문 종류", "호가창 보기", "배당과 증자"],
             "content_slnos": [], "expected_minutes": 50},
            {"week_number": 4, "theme": "첫 투자자가 가장 많이 빠지는 함정",
             "description": "시작하자마자 사기에 당하지 않기.",
             "learning_goals": ["리딩방 사기", "가짜 거래소", "빚투의 위험"],
             "content_slnos": [], "expected_minutes": 50},
        ],
    },
]


# ============================================================
# 헬퍼 함수
# ============================================================
def get_path_by_id(path_id: str) -> Optional[dict]:
    """ID로 학습경로 찾기"""
    for path in LEARNING_PATHS:
        if path["id"] == path_id:
            return path
    return None


def get_all_path_ids() -> list[str]:
    """모든 학습경로 ID 리스트"""
    return [p["id"] for p in LEARNING_PATHS]


# ============================================================
# 매칭 규칙: 설문 답변 → 학습경로 매칭
# ============================================================
LIFE_STAGE_TO_AUDIENCE = {
    "teen": ["H", "C"],
    "college": ["U", "Y"],
    "rookie": ["Y"],
    "midcareer": ["Y", "A"],
    "preretire": ["A"],
    "retired": ["R"],
    "military": ["AM"],
    "debt_crisis": ["F", "Y", "A"],
}


def match_learning_paths(
    life_stage: str,
    primary_concern: Optional[str] = None,
    age: Optional[int] = None,
    weekly_hours: int = 2,
    top_n: int = 3,
) -> list[dict]:
    """
    설문 답변을 받아서 적합한 학습경로 추천.

    Args:
        life_stage: 인생 단계 (LIFE_STAGE_TO_AUDIENCE의 키)
        primary_concern: 주요 고민 (fraud / wealth / debt / retirement / literacy)
        age: 나이
        weekly_hours: 주당 학습 가능 시간
        top_n: 반환할 학습경로 수

    Returns:
        매칭된 학습경로 리스트 (점수 높은 순)
    """
    target_audiences = LIFE_STAGE_TO_AUDIENCE.get(life_stage, [])

    matches = []
    for path in LEARNING_PATHS:
        score = 0
        path_audiences = set(path.get("target_audience", []))

        # 1. 인생 단계 매칭 (40점)
        common = set(target_audiences) & path_audiences
        if common:
            match_ratio = len(common) / len(path_audiences)
            score += int(40 * match_ratio)

        # 2. 주요 고민 매칭 (30점)
        if primary_concern:
            concern_to_goals = {
                "fraud": ["fraud_prevention", "financial_safety"],
                "wealth": ["wealth_building", "investment_start"],
                "debt": ["financial_safety"],
                "retirement": ["retirement"],
                "literacy": ["financial_literacy"],
            }
            target_goals = concern_to_goals.get(primary_concern, [])
            path_goals = set(path.get("target_goals", []))
            if any(g in path_goals for g in target_goals):
                score += 30

        # 3. 나이 적합성 (20점)
        if age is not None:
            age_range = path.get("target_age_range", [0, 100])
            if age_range[0] <= age <= age_range[1]:
                score += 20
            elif abs(age - age_range[0]) <= 5 or abs(age - age_range[1]) <= 5:
                score += 10

        # 4. 시간 적합성 (10점)
        path_hours = path.get("weekly_hours", 2)
        if abs(path_hours - weekly_hours) <= 1:
            score += 10
        elif abs(path_hours - weekly_hours) <= 2:
            score += 5

        if score > 0:
            matches.append({"path": path, "score": score})

    matches.sort(key=lambda m: m["score"], reverse=True)
    return matches[:top_n]
