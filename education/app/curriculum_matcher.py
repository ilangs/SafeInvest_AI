"""
학습경로 콘텐츠 매칭 모듈

역할:
  주어진 학습경로(path)와 실데이터(contents_by_topic)로부터
  각 주차의 콘텐츠를 채워 넣는다.

설계 원칙:
  1. 명시적 주제 풀 - data.topic_pools.WEEK_TOPIC_POOLS 우선
  2. 중복 제거 - 한 학습경로 안에서 같은 콘텐츠는 한 번만 사용
  3. 품질 우선순위 - YouTube + 메타 완성도 + 적정 길이
  4. fallback 명확화 - 풀이 비면 키워드로 fallback, 그래도 없으면 "준비 중"
"""
import re
from typing import Optional

from data.topic_pools import get_topic_pool


# ============================================================
# 키워드 fallback (명시적 풀이 비어 있을 때만 사용)
# ============================================================
_KEYWORD_TO_TOPIC: list[tuple[list[str], str]] = [
    (["수입", "지출", "가계부", "예산"], "1001"),
    (["결제", "현금", "카드 사용"], "1004"),
    (["예금", "적금", "저축"], "2001"),
    (["투자 기초", "투자의 기초", "주식 기초", "증권"], "2002"),
    (["투자상품", "펀드", "etf", "채권"], "2003"),
    (["신용", "신용점수", "신용등급"], "3001"),
    (["대출", "주담대"], "3002"),
    (["신용카드"], "3003"),
    (["부채", "연체"], "3004"),
    (["위험", "분산투자", "변동성"], "4001"),
    (["보험"], "4002"),
    (["금융거래", "이체", "송금"], "5001"),
    (["디지털", "모바일 뱅킹", "핀테크"], "5002"),
    (["소비자보호", "권리"], "5004"),
    (["사기", "보이스피싱", "스미싱"], "5005"),
    (["생애재무", "재무설계", "재무 목표"], "6001"),
    (["취업", "창업"], "6002"),
    (["학자금", "교육비"], "6003"),
    (["주거", "주택"], "6004"),
    (["노후", "은퇴", "연금"], "6005"),
]


def _fallback_keyword_topics(week: dict) -> list[str]:
    """주차의 theme/description/learning_goals에서 키워드로 주제 코드 추론"""
    text = (
        (week.get("theme") or "") + " " +
        (week.get("description") or "") + " " +
        " ".join(week.get("learning_goals") or [])
    ).lower()
    codes = []
    for keywords, code in _KEYWORD_TO_TOPIC:
        if any(k in text for k in keywords):
            codes.append(code)
    return codes


# ============================================================
# 콘텐츠 점수화 (같은 풀 안에서 어떤 걸 우선할지)
# ============================================================

# 학습경로 차원의 부적절 키워드 (해당 학습경로에서는 이 키워드 들어간 콘텐츠 감점)
# ============================================================
# 주차별 명시 키워드 (학습목표를 도메인 지식으로 풀어 다양한 표현 포함)
# 이게 정의되어 있으면 _learning_goal_keywords()는 이걸 우선 사용.
# 없으면 theme/learning_goals에서 자동 추출.
# ============================================================
WEEK_KEYWORDS: dict[tuple[str, int], list[str]] = {
    # ────────────── ① 청소년 ──────────────
    ("teen_first_finance_4w", 1): ["용돈", "수입", "지출", "기록", "소비"],
    ("teen_first_finance_4w", 2): ["통장", "예금", "적금", "이자", "은행", "저축"],
    ("teen_first_finance_4w", 3): ["체크카드", "신용카드", "결제", "간편결제", "카드"],
    ("teen_first_finance_4w", 4): ["보이스피싱", "스미싱", "사기", "사칭", "피싱"],

    # ────────────── ② 대학생 ──────────────
    ("college_career_prep_4w", 1): ["청년", "통장", "체크카드", "신용점수", "신용"],
    ("college_career_prep_4w", 2): ["학자금", "대출", "상환", "장학"],
    ("college_career_prep_4w", 3): ["주식", "ETF", "투자", "소액", "주린이"],
    ("college_career_prep_4w", 4): ["창업", "취업", "비상금", "면접", "구직", "신입"],

    # ────────────── ③ 사회초년생 ──────────────
    ("rookie_first_year_6w", 1): ["월급", "통장", "자동이체", "월급관리"],
    ("rookie_first_year_6w", 2): ["비상금", "파킹", "적금", "예비자금", "예적금"],
    ("rookie_first_year_6w", 3): ["신용카드", "신용점수", "체크카드", "신용"],
    ("rookie_first_year_6w", 4): ["청약", "주거", "전세", "월세", "주택", "임대차"],
    ("rookie_first_year_6w", 5): ["ETF", "분산투자", "분산", "자산배분", "자산 배분"],
    ("rookie_first_year_6w", 6): ["사기", "보이스피싱", "명의도용", "스미싱"],

    # ────────────── ④ 본격 재테크 ──────────────
    ("wealth_building_8w", 1): [
        "인플레이션", "복리", "재무목표", "월급통장", "목돈",
        "왜 투자", "예금만", "저축의 한계", "재무설계",
    ],
    ("wealth_building_8w", 2): [
        "변동성", "리스크", "위험", "안전자산", "위험자산", "위험성향",
        "손실", "수익률",
    ],
    ("wealth_building_8w", 3): [
        "분산투자", "분산", "자산배분", "자산 배분", "포트폴리오",
        "계란", "바구니",
    ],
    ("wealth_building_8w", 4): ["ETF", "상장지수"],
    ("wealth_building_8w", 5): ["펀드", "채권"],
    ("wealth_building_8w", 6): ["ISA"],
    ("wealth_building_8w", 7): ["연금저축", "IRP", "세액공제", "퇴직연금"],
    ("wealth_building_8w", 8): [
        "투자 원칙", "투자원칙", "리밸런싱", "자산관리", "자산 관리",
    ],

    # ────────────── ⑤ 50대 노후 점검 ──────────────
    ("midlife_retire_check_6w", 1): [
        "노후자금", "노후 자금", "은퇴", "노후 준비", "노후",
    ],
    ("midlife_retire_check_6w", 2): [
        "국민연금", "퇴직연금", "개인연금", "3층", "연금",
    ],
    ("midlife_retire_check_6w", 3): ["퇴직금", "IRP", "퇴직연금"],
    ("midlife_retire_check_6w", 4): [
        "자산배분", "자산 배분", "주식", "채권", "안전자산",
        "TDF", "생애주기",
    ],
    ("midlife_retire_check_6w", 5): [
        "보험", "실손", "암보험", "간병", "보장",
    ],
    ("midlife_retire_check_6w", 6): [
        "주택연금", "주거", "노후 소득", "소득공백", "임금피크",
    ],

    # ────────────── ⑥ 은퇴 후 ──────────────
    ("post_retire_4w", 1): [
        "인출", "연금", "은퇴자금", "은퇴 자금", "노후",
    ],
    ("post_retire_4w", 2): ["채권", "예금", "안전자산", "노후"],
    ("post_retire_4w", 3): [
        "모바일", "스마트폰", "디지털", "보안", "온라인",
    ],
    ("post_retire_4w", 4): [
        "보이스피싱", "사기", "노년", "노인",
    ],

    # ────────────── ⑦ 금융사기 ──────────────
    ("fraud_defense_4w", 1): ["보이스피싱", "사칭", "피싱"],
    ("fraud_defense_4w", 2): ["스미싱", "메신저", "피싱", "문자"],
    ("fraud_defense_4w", 3): [
        "투자사기", "리딩방", "코인", "도박", "가상자산", "영끌", "빚투",
    ],
    ("fraud_defense_4w", 4): [
        "불법사금융", "불법 사금융", "전세사기", "대출사기", "대출 사기",
    ],

    # ────────────── ⑧ 군장병 ──────────────
    ("military_savings_4w", 1): [
        "군장병", "군간부", "봉급", "군 봉급", "통장", "군대",
    ],
    ("military_savings_4w", 2): [
        "군적금", "청년도약", "적금", "월급", "장병내일준비",
    ],
    ("military_savings_4w", 3): [
        "1000만원", "1,000만원", "천만원", "목돈", "예산", "군장병", "군 장병",
    ],
    ("military_savings_4w", 4): [
        "전역", "학자금", "취업", "제대",
    ],

    # ────────────── ⑨ 빚 관리 ──────────────
    ("debt_escape_5w", 1): ["부채", "신용정보", "조회", "빚"],
    ("debt_escape_5w", 2): ["신용점수", "연체", "신용등급"],
    ("debt_escape_5w", 3): [
        "대환대출", "상환", "고금리", "DSR",
    ],
    ("debt_escape_5w", 4): [
        "채무조정", "워크아웃", "개인회생", "신용회복",
        "채무자구제", "채무 조정",
    ],
    ("debt_escape_5w", 5): [
        "신용 재건", "신용재건", "재기", "신용회복", "신용 회복",
    ],

    # ────────────── ⑩ 리포트·산업 분석 ──────────────
    ("smart_investor_report_5w", 1): [
        "주린이", "주식용어", "재무제표", "투자가이드",
        "투자개념", "PER", "PBR", "ROE",
    ],
    ("smart_investor_report_5w", 2): [
        "리포트 제대로 보기", "리포트", "목표주가",
        "증권사", "치트키",
    ],
    ("smart_investor_report_5w", 3): [
        "리포트 제대로 보기",
        "반도체", "2차 전지", "2차전지", "조선", "전기차",
        "K-방산", "방산", "철강", "정유", "석유",
    ],
    ("smart_investor_report_5w", 4): [
        "리포트 제대로 보기",
        "게임", "OTT", "콘텐츠", "K-푸드", "K푸드",
        "화장품", "바이오", "웹툰", "음식료",
    ],
    ("smart_investor_report_5w", 5): [
        "투자 이야기", "워런 버핏", "케인스", "닷컴",
        "금융위기", "버블", "가치투자", "찰스 다우",
        "헤지펀드", "이황",
    ],

    # ────────────── ⑪ 절세 마스터 ──────────────
    ("tax_smart_investor_4w", 1): [
        "세테크", "절세", "세후", "세금", "과세",
    ],
    ("tax_smart_investor_4w", 2): [
        "세테크", "ISA", "비과세", "분리과세", "손익통산",
        "절세상품", "절세형",
    ],
    ("tax_smart_investor_4w", 3): [
        "세테크", "양도소득세", "양도세",
        "금융소득종합과세", "종합과세",
        "해외주식", "파생상품",
    ],
    ("tax_smart_investor_4w", 4): [
        "세테크", "연금", "상속", "증여", "건보료",
        "연말정산",
    ],

    # ────────────── ⑫ 투자 첫걸음 실전 ──────────────
    ("investing_first_steps_4w", 1): [
        "투자와 투기", "투자일까", "투기", "잃지 않는",
        "투자 시작", "원칙",
    ],
    ("investing_first_steps_4w", 2): [
        "MTS", "HTS", "계좌", "비대면", "증권계좌",
        "입금", "출금", "주린이", "서명",
    ],
    ("investing_first_steps_4w", 3): [
        "주린이", "주문", "호가", "배당", "증자",
        "주식시장", "거래 방법", "빨간선", "파란선",
    ],
    ("investing_first_steps_4w", 4): [
        "리딩방", "주식리딩방", "가짜 거래소", "고수익 보장",
        "종목 추천", "투기", "빚투", "영끌",
    ],
}


PATH_PENALTY_KEYWORDS: dict[str, list[str]] = {
    "wealth_building_8w": [
        "도박", "한국도박문제예방치유원",
        "청소년 주식투자",
        "보이스피싱",
        "전세사기",
        "군장병", "군간부",                # 대괄호 없이도 잡음
        "자립준비청년",
    ],
    "midlife_retire_check_6w": [
        "도박", "한국도박문제예방치유원",
        "청소년 주식투자",
        "군장병", "군간부",
        "자립준비청년",
    ],
    "post_retire_4w": [
        "청소년 주식투자",
        "군장병", "군간부",
        "자립준비청년",
    ],
    "rookie_first_year_6w": [
        "청소년 주식투자",
        "군장병", "군간부",
        "한국도박문제예방치유원",
    ],
    "college_career_prep_4w": [
        "청소년 주식투자",
        "군장병", "군간부",
        "한국도박문제예방치유원",
        "노후", "은퇴", "퇴직연금",
    ],
    "teen_first_finance_4w": [
        "노후", "은퇴", "퇴직연금", "IRP",
        "사회초년생", "신입사원", "신혼", "주거",
        "군장병", "군간부",
        "자립준비청년",
        "사모펀드", "DLS", "DLF", "파생결합",
    ],
    "fraud_defense_4w": [
        "청소년 주식투자",
        "사모펀드", "DLS", "DLF",
    ],
    "military_savings_4w": [
        "청소년 주식투자",
        "노후 의료비", "퇴직연금",
        "한국도박문제예방치유원",
    ],
    "debt_escape_5w": [
        "청소년 주식투자",
        "군장병", "군간부",
        "한국도박문제예방치유원",
        "노후", "은퇴",
    ],

    "smart_investor_report_5w": [
        "한국도박문제예방치유원", "도박",
        "청소년 주식투자",
        "군장병", "군간부",
        "보이스피싱", "스미싱",
        "자립준비청년",
    ],

    "tax_smart_investor_4w": [
        "한국도박문제예방치유원", "도박",
        "청소년 주식투자",
        "군장병", "군간부",
        "보이스피싱", "스미싱",
        "자립준비청년",
    ],

    "investing_first_steps_4w": [
        "한국도박문제예방치유원", "도박",
        "[청소년 주식투자",
        "군장병", "군간부",
        "노후", "은퇴", "퇴직연금", "IRP",
        "자립준비청년",
        "사모펀드", "DLS", "DLF",
    ],
}


def _learning_goal_keywords(week: dict, path_id: str = None) -> list[str]:
    """
    주차의 핵심 키워드 반환.

    1. WEEK_KEYWORDS에 명시되어 있으면 그것 우선 (도메인 지식 반영)
    2. 없으면 theme/learning_goals에서 자동 추출
    """
    # 1순위: 명시 키워드
    if path_id and week is not None:
        wk = week.get("week_number")
        explicit = WEEK_KEYWORDS.get((path_id, wk))
        if explicit:
            return explicit

    # 2순위: 자동 추출
    text_parts = [week.get("theme", "")]
    for g in week.get("learning_goals", []) or []:
        text_parts.append(g)
    full = " ".join(text_parts)

    raw_words = re.findall(r"[가-힣]{2,}|[A-Za-z]{2,}", full)
    stop = {
        "이해", "활용", "관리", "기초", "준비", "시작", "방법", "분석",
        "어떻게", "왜냐", "위험", "수익", "이상", "이하",
        "자산", "투자", "금융", "사람", "구분",
    }
    keywords = [w for w in raw_words if w not in stop and len(w) >= 2]
    return list(set(keywords))


def _has_required_keyword(content: dict, keywords: list[str]) -> bool:
    """콘텐츠 제목 또는 요약에 키워드 중 하나라도 포함되면 True."""
    if not keywords:
        return True
    title = content.get("title") or content.get("contentsTitle") or ""
    summary = (
        content.get("contentsExpln") or
        content.get("description") or
        content.get("smrtnCntnt") or ""
    )
    text = (title + " " + summary).lower()
    return any(kw.lower() in text for kw in keywords)


def _quality_score(content: dict, week: dict = None, path_id: str = None) -> int:
    """
    콘텐츠 품질 점수 (높을수록 우선).

    1. 기본 품질 점수 (YouTube/길이/신선도)
    2. 주차 학습목표 키워드 매칭 가산점 (week 제공 시)
    3. 학습경로 부적절 키워드 감점 (path_id 제공 시)
    """
    score = 0

    # ── 1. 기본 품질 ──
    url = (content.get("xtrnlContentsUrl") or "").lower()
    if "youtube" in url or "youtu.be" in url:
        score += 50

    if content.get("thumbnailUrl") or content.get("imgFilePath"):
        score += 10

    summary = content.get("contentsExpln") or content.get("description") or ""
    if len(summary.strip()) >= 20:
        score += 10

    minutes = _parse_playtime_minutes(content.get("playtime"))
    if minutes is not None:
        if 3 <= minutes <= 30:
            score += 20
        elif minutes < 1:
            score -= 30
        elif minutes > 60:
            score -= 10

    year = content.get("makeYear") or content.get("year")
    try:
        y = int(year) if year else 0
        if y >= 2020:
            score += 15
        elif y >= 2015:
            score += 5
    except (TypeError, ValueError):
        pass

    # ── 2. 주차 학습목표 키워드 매칭 (주차 제공 시) ──
    title = content.get("title") or content.get("contentsTitle") or ""
    title_summary = (title + " " + summary).lower()

    if week is not None:
        keywords = _learning_goal_keywords(week, path_id=path_id)
        match_count = 0
        for kw in keywords:
            if kw.lower() in title_summary:
                match_count += 1
        if match_count > 0:
            # 첫 매칭 +50, 추가 매칭마다 +20 (최대 +90)
            score += min(50 + (match_count - 1) * 20, 90)

    # ── 3. 학습경로 부적절 키워드 감점 (path_id 제공 시) ──
    if path_id and path_id in PATH_PENALTY_KEYWORDS:
        for bad in PATH_PENALTY_KEYWORDS[path_id]:
            if bad.lower() in title.lower():
                score -= 100   # 매우 강한 감점
                break  # 한 번만 감점 (여러 키워드 중복 방지)

    return score



def _parse_playtime_minutes(playtime) -> Optional[float]:
    """playtime 문자열을 분 단위 숫자로. '5분', '12:34', '300' (초) 등 다양한 포맷 처리."""
    if not playtime:
        return None
    if isinstance(playtime, (int, float)):
        return float(playtime)
    s = str(playtime).strip()
    if not s:
        return None
    # "MM:SS" 또는 "HH:MM:SS"
    if ":" in s:
        parts = s.split(":")
        try:
            parts_f = [float(p) for p in parts]
            if len(parts_f) == 2:
                return parts_f[0] + parts_f[1] / 60.0
            if len(parts_f) == 3:
                return parts_f[0] * 60 + parts_f[1] + parts_f[2] / 60.0
        except ValueError:
            return None
    # "5분", "5min" 같은 형태
    digits = "".join(ch for ch in s if ch.isdigit() or ch == ".")
    if digits:
        try:
            return float(digits)
        except ValueError:
            return None
    return None


# ============================================================
# 교육대상 필터 (eduTrgtCntnt 매칭)
# ============================================================
def _matches_target_audience(content: dict, target_audience: list[str]) -> bool:
    """
    콘텐츠의 eduTrgtCntnt가 학습경로의 target_audience와 매칭되는지.

    규칙:
      - target_audience가 비어있으면 모두 통과 (필터 없음)
      - 콘텐츠의 eduTrgtCntnt(콤마 구분)에 target_audience 중 하나라도 포함되면 통과
      - 아예 eduTrgtCntnt가 없는 콘텐츠도 통과 (대상 무관 콘텐츠로 간주)
    """
    if not target_audience:
        return True

    raw = (content.get("eduTrgtCntnt") or "").strip()
    if not raw:
        # 대상 미명시 콘텐츠는 모든 대상에게 보여줌
        return True

    targets = [t.strip() for t in raw.split(",") if t.strip()]
    return any(t in target_audience for t in targets)


# ============================================================
# 메인 매칭 함수
# ============================================================
def match_contents_for_path(
    path: dict,
    contents_by_topic: dict,
    all_contents_by_slno: dict,
) -> list[dict]:
    """
    학습경로 전체에 대해 주차별 콘텐츠를 매칭.

    Args:
        path: 학습경로 정의 dict (id, weeks, target_audience, ...)
        contents_by_topic: {topic_code: [content, ...]}
        all_contents_by_slno: {slno: content} (명시적 ID 매핑용)

    Returns:
        주차별 매칭 결과 리스트.
    """
    path_id = path["id"]
    target_audience = path.get("target_audience", [])

    # 학습경로 전체에서 이미 사용된 콘텐츠 ID 추적 (주차 간 중복 방지)
    used_slnos: set[str] = set()

    hydrated_weeks = []

    for week in path["weeks"]:
        week_number = week["week_number"]
        target_count = len(week.get("content_slnos") or [])
        if target_count == 0:
            target_count = 3  # 기본값

        week_contents: list[dict] = []

        # ──────────────────────────────────────────────
        # 1단계: content_slnos 명시 ID 매칭
        # ──────────────────────────────────────────────
        for slno in week.get("content_slnos") or []:
            if slno in used_slnos:
                continue
            content = all_contents_by_slno.get(slno)
            if content:
                week_contents.append(_to_week_content(content))
                used_slnos.add(slno)

        # ──────────────────────────────────────────────
        # 2단계: 명시 풀(topic_pools) 기반 자동 선택 + 교육대상 필터
        # ──────────────────────────────────────────────
        if len(week_contents) < target_count:
            needed = target_count - len(week_contents)
            topic_pool = get_topic_pool(path_id, week_number)

            # 명시 풀 비어있으면 키워드 fallback
            if not topic_pool:
                topic_pool = _fallback_keyword_topics(week)

            picks = _pick_best_from_topics(
                topic_pool,
                contents_by_topic,
                used_slnos,
                needed,
                target_audience=target_audience,
                week=week,
                path_id=path_id,
            )
            for p in picks:
                week_contents.append(_to_week_content(p))
                used_slnos.add(p["contentsSlno"])

        # ──────────────────────────────────────────────
        # 3단계: 그래도 부족 → "준비 중" 표시
        # ──────────────────────────────────────────────
        while len(week_contents) < target_count:
            week_contents.append({
                "contents_slno": f"placeholder_{path_id}_{week_number}_{len(week_contents)}",
                "title": "(콘텐츠 준비 중)",
                "summary": "이 주제에 적합한 콘텐츠가 부족합니다. 추후 보완 예정입니다.",
                "make_type_code": "",
                "url": None,
                "playtime_minutes": "",
            })

        # ──────────────────────────────────────────────
        # 4단계: 같은 주차 안에서 학습 흐름 정렬 (쉬운 → 어려운)
        # ──────────────────────────────────────────────
        week_contents = _sort_by_difficulty(week_contents)

        hydrated_weeks.append({
            "week_number": week_number,
            "theme": week["theme"],
            "description": week["description"],
            "learning_goals": week.get("learning_goals", []),
            "expected_minutes": week.get("expected_minutes", 30),
            "contents": week_contents,
        })

    return hydrated_weeks


# ============================================================
# 풀에서 후보 가져오기 (품질 점수 정렬 + 풀 우선순위)
# ============================================================
def _pick_best_from_topics(
    topic_codes: list[str],
    contents_by_topic: dict,
    used_slnos: set,
    needed: int,
    target_audience: list[str] = None,
    week: dict = None,
    path_id: str = None,
) -> list[dict]:
    """
    여러 주제 코드의 풀에서 needed개의 최적 콘텐츠 선택.

    엄격 모드:
      1. 풀 + 교육대상 + 학습목표 키워드 모두 매칭 (가장 엄격)
      2. 풀 + 교육대상 (키워드 매칭 안 돼도 OK) — fallback
      3. 풀 + 교육대상 무관 — 마지막 fallback

    각 단계에서 needed 만족하면 다음 단계 안 감.
    품질 점수에는 키워드 가산점 + 부적절 키워드 감점 포함.
    """
    if not topic_codes or needed <= 0:
        return []

    target_audience = target_audience or []

    # 단계 1: 키워드 + 교육대상 모두 엄격
    picks = _pick_with_filter(
        topic_codes, contents_by_topic, used_slnos, needed,
        target_audience=target_audience, week=week, path_id=path_id,
        require_keyword=True,
    )

    # 단계 2: 키워드 풀고 교육대상만 (부족분만 보강)
    if len(picks) < needed:
        already_picked = {p["contentsSlno"] for p in picks}
        excluded = used_slnos | already_picked
        more = _pick_with_filter(
            topic_codes, contents_by_topic, excluded, needed - len(picks),
            target_audience=target_audience, week=week, path_id=path_id,
            require_keyword=False,
        )
        picks.extend(more)

    # 단계 3: 교육대상도 풀기 (가장 마지막)
    if len(picks) < needed and target_audience:
        already_picked = {p["contentsSlno"] for p in picks}
        excluded = used_slnos | already_picked
        more = _pick_with_filter(
            topic_codes, contents_by_topic, excluded, needed - len(picks),
            target_audience=[], week=week, path_id=path_id,
            require_keyword=False,
        )
        picks.extend(more)

    return picks[:needed]


def _pick_with_filter(
    topic_codes: list[str],
    contents_by_topic: dict,
    used_slnos: set,
    needed: int,
    target_audience: list[str],
    week: dict = None,
    path_id: str = None,
    require_keyword: bool = False,
) -> list[dict]:
    """
    풀에서 교육대상 필터 + 품질 점수로 정렬해서 needed개 선택.

    품질 점수 계산 시 week, path_id를 전달하여:
      - 주차 학습목표 키워드 매칭 가산점
      - 학습경로 부적절 키워드 감점

    풀 우선순위 가중치:
      1순위 풀에서 needed의 60% (최소 1개)
      2순위 이하 풀에서 나머지
      그래도 부족하면 1순위에서 더 채움
    """
    if not topic_codes or needed <= 0:
        return []

    # 학습목표 키워드 미리 계산 (require_keyword=True일 때만 사용)
    keywords = []
    if require_keyword and week is not None:
        keywords = _learning_goal_keywords(week, path_id=path_id)

    # 각 풀별로 필터 + 품질 점수 정렬된 후보 큐
    queues = []
    for tc in topic_codes:
        pool = contents_by_topic.get(tc, [])
        candidates = [
            c for c in pool
            if c.get("contentsSlno")
            and c["contentsSlno"] not in used_slnos
            and _matches_target_audience(c, target_audience)
        ]
        # 키워드 매칭 필수 모드
        if require_keyword and keywords:
            candidates = [c for c in candidates if _has_required_keyword(c, keywords)]
        # 점수 기반 정렬 (주차/학습경로 컨텍스트 반영)
        candidates.sort(
            key=lambda c: _quality_score(c, week=week, path_id=path_id),
            reverse=True,
        )
        # 너무 낮은 점수(부적절 키워드 강감점)는 제외 - 0점 미만 컷
        candidates = [c for c in candidates if _quality_score(c, week=week, path_id=path_id) >= 0]
        queues.append(candidates)

    picks: list[dict] = []
    seen_in_run = set()

    if len(queues) == 1:
        # 풀 1개: 그냥 상위 needed개
        for c in queues[0]:
            if c["contentsSlno"] not in seen_in_run:
                picks.append(c)
                seen_in_run.add(c["contentsSlno"])
                if len(picks) >= needed:
                    break
    else:
        # 풀 여러 개: 1순위 60%, 나머지 40%
        first_quota = max(1, (needed * 6 + 9) // 10)

        # 1순위 풀
        for c in queues[0]:
            if c["contentsSlno"] not in seen_in_run:
                picks.append(c)
                seen_in_run.add(c["contentsSlno"])
                if len(picks) >= first_quota:
                    break

        # 2순위 이하 풀
        for q in queues[1:]:
            if len(picks) >= needed:
                break
            for c in q:
                if c["contentsSlno"] not in seen_in_run:
                    picks.append(c)
                    seen_in_run.add(c["contentsSlno"])
                    if len(picks) >= needed:
                        break

        # 그래도 부족하면 1순위 풀에서 더 채움
        if len(picks) < needed:
            for c in queues[0]:
                if c["contentsSlno"] not in seen_in_run:
                    picks.append(c)
                    seen_in_run.add(c["contentsSlno"])
                    if len(picks) >= needed:
                        break

    return picks[:needed]


# ============================================================
# 같은 주차 안 정렬 (쉬운 → 어려운)
# ============================================================
def _sort_by_difficulty(week_contents: list[dict]) -> list[dict]:
    """
    같은 주차 안에서 콘텐츠를 쉬운 것 → 어려운 것 순서로 정렬.

    난이도 추정:
      - 짧은 영상 (1~10분) = 쉬움
      - 긴 영상 (>30분) = 어려움
      - 도서/PDF = 중간
      - 카드뉴스/웹툰 = 쉬움
      - 오디오북 = 중간
      - placeholder는 맨 뒤
    """
    def difficulty(c: dict) -> int:
        # placeholder는 가장 뒤
        if str(c.get("contents_slno", "")).startswith("placeholder"):
            return 999

        type_code = str(c.get("make_type_code", ""))
        # 1=영상, 2=도서, 3=웹툰, 6=카드뉴스, 7=웹진, 8=오디오북
        type_difficulty = {
            "3": 1,  # 웹툰 (가장 쉬움)
            "6": 1,  # 카드뉴스
            "1": 3,  # 영상
            "8": 4,  # 오디오북
            "7": 5,  # 웹진
            "2": 6,  # 도서 (가장 어려움)
        }.get(type_code, 5)

        # 영상은 길이로 세분화
        if type_code == "1":
            mins = _parse_playtime_minutes(c.get("playtime_minutes"))
            if mins is not None:
                if mins < 5:
                    type_difficulty = 2
                elif mins > 30:
                    type_difficulty = 7

        return type_difficulty

    return sorted(week_contents, key=difficulty)


# ============================================================
# 콘텐츠 변환 (raw 금감원 데이터 → 프론트에서 쓰는 dict)
# ============================================================
def _to_week_content(content: dict) -> dict:
    """금감원 raw 콘텐츠를 학습경로 주차에 들어갈 형태로 변환"""
    type_code = str(content.get("makeTypeCode") or "")

    # URL 우선순위: YouTube > 외부 URL > fileDown
    url = content.get("xtrnlContentsUrl") or ""
    file_down_url = content.get("fileDownUrl") or ""
    atch_file_id = content.get("atchFileId") or ""

    # v2.10: 재생 가능 여부 판정
    is_playable, playable_reason = _check_playable(type_code, url, file_down_url)
    learning_mode = "watch" if is_playable else "ai_summary"

    return {
        "contents_slno": content["contentsSlno"],
        "title": content.get("contentsTitle") or content.get("title") or "(제목 없음)",
        "summary": (content.get("contentsExpln") or content.get("description") or "")[:200],
        "make_type_code": type_code,
        "make_type_name": content.get("makeTypeName") or _make_type_name(type_code),
        "url": url or file_down_url or None,
        "file_down_url": file_down_url,
        "atch_file_id": atch_file_id,
        "playtime_minutes": content.get("playtime") or "",
        "thumbnail_url": content.get("thumbnailUrl") or content.get("imgFilePath") or "",
        # v2.10 신규
        "is_playable": is_playable,
        "learning_mode": learning_mode,
        "playable_reason": playable_reason,
    }


def _check_playable(make_type_code: str, external_url: str, file_down_url: str) -> tuple[bool, str]:
    """
    클라이언트에서 실제로 재생/열람 가능한지 판정.
    (app/main.py의 동일 함수와 일관 유지)
    """
    ext = (external_url or "").lower()
    file_url = file_down_url or ""

    if make_type_code == "1":
        if "youtu" in ext:
            return True, "YouTube"
        if ext.startswith("http") and "fss.or.kr" not in ext and "vod" not in ext:
            return True, "external_video"
        return False, "fss_vod_blocked"
    elif make_type_code == "2":
        return (True, "pdf") if file_url else (False, "no_file")
    elif make_type_code == "3":
        if ext and "fss.or.kr" in ext:
            return False, "webtoon_iframe_blocked"
        return (True, "external_webtoon") if ext else (False, "no_url")
    elif make_type_code == "8":
        return (True, "audio") if (ext or file_url) else (False, "no_url")
    elif make_type_code in ("4", "5", "6", "7"):
        return (True, f"type_{make_type_code}") if (ext or file_url) else (False, "no_url")
    return False, "unknown"


def _make_type_name(code: str) -> str:
    return {
        "1": "영상/애니메이션",
        "2": "도서",
        "3": "웹툰/만화",
        "4": "교육과정",
        "5": "기타",
        "6": "카드뉴스",
        "7": "웹진",
        "8": "오디오북",
    }.get(code, "기타")
