"""
교육센터 주제 × 레벨 + 하부 주제 분석 스크립트

각 주제 코드의 콘텐츠 제목들을 분석해서, 자주 등장하는 시리즈/태그/키워드를
"하부 주제"로 추출하여 마크다운 표로 출력한다.

사용법:
    python scripts/analyze_topics.py

출력:
    - 콘솔에 마크다운 표
    - data/topic_subcategories.md 파일로도 저장
"""
import json
import re
from collections import Counter
from pathlib import Path


# ============================================================
# 주제 코드 → 한글명 + 레벨 매핑
# ============================================================
TOPIC_INFO = {
    # 🌱 Level 1: 금융 입문
    "1001": {"name": "수입과지출",        "level": "Level 1: 금융 입문"},
    "1002": {"name": "가계부작성",        "level": "Level 1: 금융 입문"},
    "1003": {"name": "예산짜기",          "level": "Level 1: 금융 입문"},
    "1004": {"name": "결제수단",          "level": "Level 1: 금융 입문"},
    "3003": {"name": "신용카드",          "level": "Level 1: 금융 입문"},
    # 🌿 Level 2: 자산 형성
    "2001": {"name": "예금",              "level": "Level 2: 자산 형성"},
    "3001": {"name": "신용의이해와관리",   "level": "Level 2: 자산 형성"},
    "5001": {"name": "금융거래의기초",    "level": "Level 2: 자산 형성"},
    "5002": {"name": "디지털금융",        "level": "Level 2: 자산 형성"},
    "5005": {"name": "금융사기예방",      "level": "Level 2: 자산 형성"},
    # 🌳 Level 3: 투자 입문
    "2002": {"name": "투자의 기초",        "level": "Level 3: 투자 입문"},
    "2003": {"name": "투자상품의 활용",    "level": "Level 3: 투자 입문"},
    "4001": {"name": "위험의개념과관리",   "level": "Level 3: 투자 입문"},
    # 🏛️ Level 4: 자산 관리
    "3002": {"name": "대출의기초와활용",  "level": "Level 4: 자산 관리"},
    "3004": {"name": "부채관리",          "level": "Level 4: 자산 관리"},
    "4002": {"name": "보험의유형과활용",   "level": "Level 4: 자산 관리"},
    "5003": {"name": "금융교육및자문",    "level": "Level 4: 자산 관리"},
    "5004": {"name": "금융소비자보호의이해", "level": "Level 4: 자산 관리"},
    # 🎯 인생 단계별
    "6001": {"name": "생애재무설계의개념과필요성", "level": "인생 단계별"},
    "6002": {"name": "창업및취업",        "level": "인생 단계별"},
    "6003": {"name": "학자금,교육비",      "level": "인생 단계별"},
    "6004": {"name": "주거마련",          "level": "인생 단계별"},
    "6005": {"name": "노후준비",          "level": "인생 단계별"},
    "6006": {"name": "노후자금관리",      "level": "인생 단계별"},
}


# ============================================================
# 무시할 일반 단어 (하부 주제에서 제외)
# ============================================================
STOP_WORDS = {
    "영상", "동영상", "교육", "금융", "콘텐츠",
    "입니다", "있습니다", "되는", "위한", "위해", "방법",
    "이해", "관리", "활용", "기초", "통해", "어떻게",
    "방법은", "어떻게", "무엇", "왜", "보는", "되는",
    "그것이", "올바른", "알아야", "어떤", "이런",
    "있는", "하는", "되는", "보다", "주의", "알아",
    "다른", "같은", "지금", "함께", "처음", "끝까지",
}


# ============================================================
# 분석 함수
# ============================================================
def extract_subcategories(titles: list[str], max_items: int = 6) -> list[str]:
    """
    제목 리스트에서 자주 등장하는 시리즈/태그/주제를 하부 주제로 추출.

    우선순위:
      1. [태그] 형식 (예: [여이주TV], [1:1 자산관리법]) - 시리즈물 식별
      2. 자주 등장하는 의미 있는 키워드
    """
    # 1. [태그] 추출 (대괄호 내용)
    tags = []
    for title in titles:
        # [내용] 패턴 (소괄호 (), 중괄호 {} 도 가끔 시리즈 표시로 쓰임)
        for match in re.findall(r'\[([^\]]+)\]', title):
            cleaned = match.strip()
            if 2 <= len(cleaned) <= 30:
                tags.append(cleaned)

    tag_counter = Counter(tags)
    # 2회 이상 등장한 태그만 시리즈로 간주
    series_tags = [t for t, c in tag_counter.most_common() if c >= 2]

    # 2. 일반 키워드 추출 (대괄호 내용 제외)
    word_counter = Counter()
    for title in titles:
        # 대괄호 내용 제거
        cleaned = re.sub(r'\[[^\]]+\]|\([^\)]+\)', '', title)
        # 한글 2글자+ 또는 영문 3글자+
        for word in re.findall(r'[가-힣]{2,}|[A-Za-z]{3,}', cleaned):
            if word in STOP_WORDS:
                continue
            if len(word) < 2:
                continue
            word_counter[word] += 1

    # 3회 이상 등장한 키워드만
    common_words = [w for w, c in word_counter.most_common(20) if c >= 3]

    # 결과 합치기: 시리즈 우선, 그 다음 일반 키워드
    result = []
    seen = set()

    for tag in series_tags:
        # 너무 긴 태그는 줄임표
        display = tag if len(tag) <= 25 else tag[:22] + "..."
        if display.lower() not in seen:
            result.append(display)
            seen.add(display.lower())
        if len(result) >= max_items:
            break

    if len(result) < max_items:
        for word in common_words:
            if word.lower() not in seen and not any(word in r for r in result):
                result.append(word)
                seen.add(word.lower())
                if len(result) >= max_items:
                    break

    return result


def main():
    project_root = Path(__file__).parent.parent
    data_file = project_root / "data" / "real_contents.json"

    if not data_file.exists():
        print(f"❌ 데이터 파일을 찾을 수 없습니다: {data_file}")
        return

    with open(data_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_items = sum(len(v) for v in data.values() if isinstance(v, list))
    print(f"📂 데이터 로드: {len(data)}개 주제, {total_items}건\n")

    # 레벨별로 그룹핑
    by_level = {}
    for code, info in TOPIC_INFO.items():
        level = info["level"]
        by_level.setdefault(level, []).append(code)

    # 마크다운 출력 빌드
    lines = []
    lines.append("# 교육센터 주제 × 레벨 + 하부 주제")
    lines.append("")
    lines.append(f"> 총 {len(data)}개 주제, {total_items}건의 콘텐츠 분석")
    lines.append("")

    level_emoji = {
        "Level 1: 금융 입문":    "🌱",
        "Level 2: 자산 형성":    "🌿",
        "Level 3: 투자 입문":    "🌳",
        "Level 4: 자산 관리":    "🏛️",
        "인생 단계별":            "🎯",
    }

    for level in [
        "Level 1: 금융 입문",
        "Level 2: 자산 형성",
        "Level 3: 투자 입문",
        "Level 4: 자산 관리",
        "인생 단계별",
    ]:
        codes = by_level.get(level, [])
        if not codes:
            continue
        emoji = level_emoji.get(level, "")
        lines.append(f"## {emoji} {level}")
        lines.append("")
        lines.append("| 코드 | 한글명 | 레벨 | 콘텐츠 수 | 하부 주제 |")
        lines.append("|---|---|---|---|---|")

        for code in sorted(codes):
            info = TOPIC_INFO[code]
            items = data.get(code, [])
            count = len(items) if isinstance(items, list) else 0

            if count == 0:
                lines.append(f"| {code} | {info['name']} | {info['level']} | 0 | (수집 안 됨) |")
                continue

            titles = [
                (it.get("contentsTitle") or it.get("title") or "")
                for it in items
            ]
            subs = extract_subcategories(titles, max_items=6)
            sub_str = " / ".join(subs) if subs else "(분석 불가)"

            lines.append(
                f"| {code} | {info['name']} | {info['level']} | {count} | {sub_str} |"
            )

        lines.append("")

    output = "\n".join(lines)
    print(output)

    # 파일로도 저장
    out_path = project_root / "data" / "topic_subcategories.md"
    out_path.write_text(output, encoding="utf-8")
    print(f"\n💾 저장됨: {out_path}")


if __name__ == "__main__":
    main()
