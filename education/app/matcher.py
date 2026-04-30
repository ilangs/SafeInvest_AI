"""
데모용 주제 매칭 엔진
- 실제 topic_matcher.py의 간소화 버전
- 외부 의존성 없음
"""

TOPIC_KEYWORDS = {
    "2001": ["예금", "적금", "저축", "이자", "정기예금", "예금자보호"],
    "2002": ["투자", "주식", "초보", "시작", "입문", "코스피", "코스닥", "종목",
             "per", "pbr", "배당", "상장", "증시", "시장"],
    "2003": ["etf", "펀드", "리츠", "채권", "분산", "분산투자", "포트폴리오",
             "자산배분", "인덱스", "해외투자", "tdf"],
    "3001": ["신용점수", "신용등급", "신용관리", "신용정보", "신용카드 발급"],
    "3002": ["대출", "융자", "담보", "이자율", "금리",
             "주택담보", "전세자금", "대환", "dsr"],
    "3004": ["부채", "빚", "빚정리", "빚 정리", "연체", "개인회생", "파산",
             "채무조정", "신용회복", "워크아웃", "채권추심"],
    "4001": ["위험", "리스크", "변동성", "손실", "안전자산",
             "헤지", "베타", "샤프", "표준편차", "손절"],
    "4002": ["보험", "실손", "연금보험", "변액", "암보험", "자동차보험", "종신"],
    "5001": ["계좌", "이체", "송금", "인터넷뱅킹", "모바일뱅킹", "간편송금"],
    "5004": ["소비자", "소비자보호", "예금자보호", "분쟁조정", "민원",
             "설명요구", "청약철회", "불완전판매", "금융소비자",
             "권리", "약관"],
    "5005": ["사기", "피싱", "보이스피싱", "스미싱", "리딩방",
             "유사수신", "대출사기", "로맨스스캠"],
    "6001": ["재무설계", "재테크", "목표", "계획", "가계부", "예산",
             "시드머니", "종잣돈", "비상금"],
    "6005": ["노후", "은퇴", "퇴직연금", "연금", "irp", "국민연금",
             "주택연금"],
}


def match_topic(question: str) -> dict:
    """
    질문에서 가장 관련성 높은 교육 주제 코드 반환

    Returns:
        { "code": str, "confidence": float, "matched_keywords": list }
    """
    question_lower = question.lower().replace(" ", "")

    best_match = None
    best_score = 0.0
    best_keywords = []

    for code, keywords in TOPIC_KEYWORDS.items():
        matched = []
        for kw in keywords:
            if kw.lower().replace(" ", "") in question_lower:
                matched.append(kw)

        if matched:
            # 매칭 점수 계산
            match_count_score = min(0.6, len(matched) * 0.25)
            max_kw_len = max(len(kw.replace(" ", "")) for kw in matched)
            length_score = min(0.4, max_kw_len * 0.08)
            confidence = min(1.0, match_count_score + length_score)

            if confidence > best_score:
                best_score = confidence
                best_match = code
                best_keywords = matched

    if not best_match or best_score < 0.3:
        return {"code": None, "confidence": 0.0, "matched_keywords": []}

    return {
        "code": best_match,
        "confidence": round(best_score, 3),
        "matched_keywords": best_keywords,
    }


def age_to_target(age: int) -> str:
    """나이 → 금감원 교육대상 코드"""
    if age < 14:
        return "P"
    elif age < 20:
        return "H"
    elif age < 35:
        return "Y"
    elif age < 60:
        return "A"
    else:
        return "R"
