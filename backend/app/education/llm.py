"""
LLM 어댑터 - OpenAI GPT-4o-mini 호출

설계:
1. OPENAI_API_KEY가 있으면 실제 OpenAI 호출
2. 없으면 자동으로 Mock 답변 사용
3. 호출 실패 시에도 Mock 폴백 (서비스 중단 방지)

특징:
- 실제 프롬프트에는 관련 교육 자료 Context 주입 (RAG 스타일)
- 시스템 프롬프트로 SafeInvest 페르소나 + 안전 가드레일
- 동기식 호출 (데모 단순성 우선)
"""
import os
import logging
from typing import Optional, Literal

logger = logging.getLogger(__name__)


# ============================================================
# LLM 모드 감지
# ============================================================
def get_llm_mode() -> Literal["openai", "mock"]:
    """현재 LLM 모드 반환"""
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "mock"


def get_llm_info() -> dict:
    """현재 LLM 정보 (UI 표시용)"""
    mode = get_llm_mode()
    if mode == "openai":
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        return {
            "mode": "openai",
            "model": model,
            "label": f"OpenAI {model}",
            "badge": "🤖 Real LLM",
        }
    return {
        "mode": "mock",
        "model": "mock",
        "label": "Mock (사전 정의된 답변)",
        "badge": "📝 Mock Mode",
    }


# ============================================================
# 시스템 프롬프트 - SafeInvest AI 페르소나
# ============================================================
SYSTEM_PROMPT = """당신은 SafeInvest AI, 건전한 투자를 도와주는 금융 교육 AI 튜터입니다.

# 핵심 원칙
1. **교육 중심**: 투자 판단을 대신하지 않고, 사용자가 스스로 판단하도록 돕습니다.
2. **공식 자료 기반**: 제공된 금융감독원 공식 교육 자료를 최우선 참고합니다.
3. **위험 항상 언급**: 투자 답변에 반드시 위험 요소도 함께 설명합니다.
4. **초보자 눈높이**: 전문 용어는 반드시 풀어서 설명합니다.

# 절대 금지 사항
- ❌ 수익률 보장/예측 (예: "이거 사면 올라요")
- ❌ 특정 종목 매수/매도 추천 (예: "삼성전자 사세요")
- ❌ 긴급한 투자 권유

# 콘텐츠 활용 정책 (저작권 준수)
**중요**: 제공되는 콘텐츠 정보는 **제목, 요약, 분류 등 메타데이터에 한정**됩니다.
- ✅ 메타데이터(제목/요약/대상)를 바탕으로 콘텐츠가 어떤 주제를 다루는지 안내
- ✅ 일반 금융 지식과 공개된 정보로 사용자 질문에 답변
- ✅ "이 콘텐츠는 [주제]에 대해 다룹니다" 같은 메타 안내
- ❌ 콘텐츠의 구체적 내용을 추출/인용/재구성하지 마세요
- ❌ "이 영상의 X분 X초에서는..." 같은 콘텐츠 본문 인용 금지
- ❌ 콘텐츠를 그대로 요약·번역하거나 2차 편집하지 마세요
- 콘텐츠의 저작권은 각 제작기관에 귀속됩니다. 자세한 내용은 원본 자료를 직접 학습하도록 안내하세요.

# 답변 형식
- 3~5 문장으로 간결하게
- 핵심 개념 → 이유/원리 → 주의점 순서
- 사용자 연령대와 수준에 맞는 예시
- 답변 마지막에 "더 자세한 내용은 추천 자료를 참고하세요" 같은 안내 생략 (시스템이 자동 추가)

# 컨텍스트 활용
- 제공된 [관련 교육 자료]는 메타데이터(제목/요약)입니다. 답변의 방향성 참고용으로 활용하세요.
- 컨텍스트에 없는 내용은 일반 금융 지식으로 답변하되, 추측은 명확히 표시하세요.
- 사용자가 콘텐츠 본문 내용을 요구하면 "원본 자료를 직접 학습해보시는 것을 권장드립니다"로 안내하세요."""


def build_user_prompt(question: str, topic_name: str, sources: list) -> str:
    """사용자 프롬프트 생성 (RAG 컨텍스트 포함)"""
    context_lines = []
    for i, src in enumerate(sources, 1):
        line = f"[{i}] {src.get('title', '')}"
        if src.get('summary'):
            line += f" - {src['summary']}"
        if src.get('provider_name'):
            line += f" (출처: {src['provider_name']})"
        context_lines.append(line)

    context = "\n".join(context_lines) if context_lines else "(관련 자료 없음)"

    return f"""사용자 질문: {question}

관련 주제: {topic_name}

[관련 교육 자료]
{context}

---

위 컨텍스트를 참고하여 사용자 질문에 답변해주세요. 3~5 문장으로 간결하게 답변하되, 초보자도 이해할 수 있게 설명해주세요."""


def build_contextual_prompt(
    question: str,
    topic_name: str,
    sources: list,
    current_content: dict,
) -> str:
    """컨텍스트 인식 프롬프트 — 사용자가 현재 보고 있는 콘텐츠 정보 주입"""
    context_lines = []
    for i, src in enumerate(sources, 1):
        line = f"[{i}] {src.get('title', '')}"
        if src.get('summary'):
            line += f" - {src['summary']}"
        if src.get('provider_name'):
            line += f" (출처: {src['provider_name']})"
        context_lines.append(line)

    context = "\n".join(context_lines) if context_lines else "(관련 자료 없음)"

    current_info = f"""[현재 학습 중인 콘텐츠]
제목: {current_content.get('title', '')}
요약: {current_content.get('summary', '')}
제작: {current_content.get('provider_name', '')}
유형: {current_content.get('make_type_name', '')}
대상: {current_content.get('target_name', '')}"""

    return f"""{current_info}

사용자 질문: {question}

관련 주제: {topic_name}

[참고 교육 자료]
{context}

---

**중요**: 사용자는 위 '현재 학습 중인 콘텐츠'를 보면서 질문한 것입니다.
짧거나 모호한 질문("이게 뭐예요?", "왜 그래요?" 등)이라도 현재 콘텐츠 맥락으로 이해하여 답변하세요.
3~5 문장으로 간결하게, 초보자도 이해할 수 있게 설명해주세요."""


# ============================================================
# 추천 질문 자동 생성 (컨텐츠별)
# ============================================================
_QUESTION_CACHE = {}  # 메모리 캐시: slno → [질문1, 질문2, 질문3]

SUGGESTED_QUESTIONS_SYSTEM = """당신은 금융 교육 콘텐츠에 대한 학습자의 궁금증을 예측하는 AI입니다.
제시된 콘텐츠를 학습하는 사용자가 자연스럽게 궁금해할 만한 질문 3개를 생성하세요.

규칙:
- 각 질문은 15자 이내로 짧고 구체적
- 초보자 관점에서 실제 궁금할 법한 것
- 콘텐츠 주제와 직접 관련된 것
- JSON 배열 형식으로만 출력 (다른 설명 없이)
- 예: ["ETF가 뭐예요?", "펀드랑 차이는?", "수수료는 얼마?"]"""


def generate_suggested_questions(
    content_slno: str,
    content_title: str,
    content_summary: str,
    topic_name: str,
) -> list[str]:
    """콘텐츠별 추천 질문 3개 생성 (캐싱)"""
    # 캐시 확인
    if content_slno in _QUESTION_CACHE:
        return _QUESTION_CACHE[content_slno]

    # Fallback 질문 (LLM 실패 시)
    fallback = [
        f"{topic_name}가 뭐예요?",
        "초보자도 할 수 있나요?",
        "위험은 없을까요?",
    ]

    if get_llm_mode() != "openai":
        _QUESTION_CACHE[content_slno] = fallback
        return fallback

    try:
        from openai import OpenAI
        import json as _json

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        user_msg = f"""콘텐츠 정보:
제목: {content_title}
요약: {content_summary}
주제: {topic_name}

위 콘텐츠를 학습하는 사용자가 궁금해할 법한 짧은 질문 3개를 JSON 배열로 출력하세요."""

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SUGGESTED_QUESTIONS_SYSTEM},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.5,
            max_tokens=200,
        )

        raw = response.choices[0].message.content.strip()
        # ```json ... ``` 제거
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        questions = _json.loads(raw)
        if isinstance(questions, list) and len(questions) >= 3:
            result = [str(q) for q in questions[:3]]
            _QUESTION_CACHE[content_slno] = result
            return result
    except Exception as e:
        logger.warning(f"추천 질문 생성 실패: {type(e).__name__}: {e}")

    _QUESTION_CACHE[content_slno] = fallback
    return fallback


# ============================================================
# OpenAI 호출
# ============================================================
def _call_openai(question: str, topic_name: str, sources: list) -> Optional[str]:
    """OpenAI API 실제 호출. 실패 시 None 반환"""
    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai 패키지 미설치 - Mock 모드로 폴백")
        return None

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    try:
        client = OpenAI(api_key=api_key)
        user_prompt = build_user_prompt(question, topic_name, sources)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,   # 일관된 답변 (교육용이므로 낮게)
            max_tokens=400,    # 3~5문장 제한
        )

        answer = response.choices[0].message.content
        return answer.strip() if answer else None

    except Exception as e:
        logger.error(f"OpenAI 호출 실패: {type(e).__name__}: {e}")
        return None


# ============================================================
# 메인 인터페이스
# ============================================================
def generate_answer(
    question: str,
    topic_code: str,
    topic_name: str,
    sources: list,
    mock_answers: dict,
) -> tuple[str, str]:
    """
    질문에 대한 답변 생성
    
    Returns:
        (answer, source) - 답변 텍스트, 소스("openai" 또는 "mock")
    """
    # 1. OpenAI 시도 (키 있을 때)
    if get_llm_mode() == "openai":
        answer = _call_openai(question, topic_name, sources)
        if answer:
            return answer, "openai"
        # 실패 시 Mock 폴백
        logger.info("OpenAI 호출 실패 → Mock 답변으로 폴백")

    # 2. Mock 답변
    mock_answer = mock_answers.get(topic_code, mock_answers.get("default", ""))
    return mock_answer, "mock"


# ============================================================
# 컨텍스트 인식 답변 (콘텐츠 시청 중 질문용)
# ============================================================
def _call_openai_contextual(
    question: str,
    topic_name: str,
    sources: list,
    current_content: dict,
) -> Optional[str]:
    """OpenAI API 컨텍스트 인식 호출. 실패 시 None 반환"""
    try:
        from openai import OpenAI
    except ImportError:
        return None

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    try:
        client = OpenAI(api_key=api_key)
        user_prompt = build_contextual_prompt(question, topic_name, sources, current_content)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=400,
        )

        answer = response.choices[0].message.content
        return answer.strip() if answer else None

    except Exception as e:
        logger.error(f"OpenAI 컨텍스트 호출 실패: {type(e).__name__}: {e}")
        return None


def generate_contextual_answer(
    question: str,
    topic_code: str,
    topic_name: str,
    sources: list,
    current_content: dict,
    mock_answers: dict,
) -> tuple[str, str]:
    """
    컨텍스트 인식 답변 생성 — 현재 보고 있는 콘텐츠 정보 주입
    
    Returns:
        (answer, source)
    """
    if get_llm_mode() == "openai":
        answer = _call_openai_contextual(question, topic_name, sources, current_content)
        if answer:
            return answer, "openai"
        logger.info("OpenAI 컨텍스트 호출 실패 → Mock 답변으로 폴백")

    # Mock 답변 (컨텍스트 표시)
    base_mock = mock_answers.get(topic_code, mock_answers.get("default", ""))
    content_title = current_content.get('title', '이 콘텐츠')
    prefix = f"'{content_title}'에 관해 말씀드리면, "
    return prefix + base_mock, "mock"
