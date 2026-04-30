"""
SafeInvest AI 데모 서버

주요 기능:
- 교육 센터 API (주제 탐색, 콘텐츠 조회)
- 챗봇 API (Mock LLM 답변 + FSS 자료 추천)
- 프론트엔드 정적 파일 서빙

실행:
    pip install fastapi uvicorn
    python -m uvicorn app.main:app --reload
    # 브라우저에서 http://localhost:8000 열기
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from pathlib import Path
import sys
import os

# ============================================================
# .env 파일 자동 로드 (python-dotenv 없이 순수 Python)
# ============================================================
_ROOT = Path(__file__).parent.parent
_ENV_FILE = _ROOT / ".env"

if _ENV_FILE.exists():
    with open(_ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            if key not in os.environ:
                os.environ[key] = value

# 상위 폴더를 import 경로에 추가
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from data.mock_data import (
    TOPIC_CATEGORIES,
    SAMPLE_CONTENTS,
    MOCK_LLM_ANSWERS,
)
from app.matcher import match_topic, age_to_target
from app.curriculum import router as curriculum_router
from app.fss_proxy import router as fss_proxy_router


# ============================================================
# FastAPI 앱 생성
# ============================================================
app = FastAPI(
    title="SafeInvest AI Demo",
    description="금감원 e-금융교육센터 API 기반 교육 플랫폼 (Mock 데모)",
    version="2.1-demo",
)

# CORS (프론트엔드 별도 서빙 시)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 학습 경로 라우터 등록
app.include_router(curriculum_router)

# 금감원 파일 프록시 라우터 등록 (확장자 없는 fileDown URL 인라인 렌더링용)
app.include_router(fss_proxy_router)


# ============================================================
# 금감원 코드 ↔ 이름 매핑 (간단 버전)
# ============================================================
PROVIDER_NAMES = {
    "1": "금융감독원", "2": "서민금융진흥원", "9": "은행연합회",
    "10": "예금보험공사", "13": "투자자교육협의회", "15": "금융투자협회",
    "32": "한국예탁결제원", "33": "한국거래소", "44": "국민연금공단",
}

MAKE_TYPE_NAMES = {
    "1": "영상/애니메이션", "2": "도서", "3": "웹툰/만화",
    "5": "체험형 교구", "6": "카드뉴스", "7": "웹진/잡지",
    "8": "오디오북",
}

TARGET_NAMES = {
    "P": "아동기", "H": "청소년기", "Y": "청년기", "A": "중장년기",
    "R": "노년기", "U": "대학생", "AM": "군장병",
}


def _check_playable(make_type_code: str, external_url: str, file_down_url: str) -> tuple[bool, str]:
    """
    클라이언트에서 실제로 재생/열람 가능한지 판정.

    Returns:
        (is_playable, reason)
    """
    ext = (external_url or "").lower()
    file_url = file_down_url or ""

    if make_type_code == "1":  # 영상
        # YouTube URL: 재생 가능
        if "youtu" in ext:
            return True, "YouTube"
        # 외부 URL이 있고 금감원 VOD가 아니면 재생 가능
        if ext.startswith("http") and "fss.or.kr" not in ext and "vod" not in ext:
            return True, "external_video"
        # 금감원 자체 VOD: iframe 거부됨
        return False, "fss_vod_blocked"

    elif make_type_code == "2":  # 도서
        return (True, "pdf") if file_url else (False, "no_file")

    elif make_type_code == "3":  # 웹툰
        if ext and "fss.or.kr" in ext:
            return False, "webtoon_iframe_blocked"
        return (True, "external_webtoon") if ext else (False, "no_url")

    elif make_type_code == "8":  # 오디오북
        return (True, "audio") if (ext or file_url) else (False, "no_url")

    elif make_type_code in ("4", "5", "6", "7"):
        return (True, f"type_{make_type_code}") if (ext or file_url) else (False, "no_url")

    return False, "unknown"


def enrich_content(raw: dict) -> dict:
    """Mock 콘텐츠 raw → API 응답 형태로 가공"""
    provider_code = str(raw.get("fncEngnCode", ""))
    make_type_code = str(raw.get("makeTypeCode", ""))
    target_code = str(raw.get("eduTrgtCntnt", ""))

    # 재생시간
    play_min = raw.get("playCntnMi", "")
    playtime = f"{play_min}분" if play_min else None

    # 두 URL 모두 보존 (프론트엔드가 유형별로 선택)
    external_url = raw.get("xtrnlContentsUrl") or ""
    file_down_url = raw.get("fileDownUrl") or ""

    # 유형별 기본 URL 우선순위
    if make_type_code in ("1", "8", "3", "5"):
        url = external_url or file_down_url
    else:
        url = file_down_url or external_url

    if not url:
        url = None

    # v2.10: 재생 가능 여부 판정
    is_playable, playable_reason = _check_playable(make_type_code, external_url, file_down_url)

    # 학습 모드: 재생 가능 → "watch", 불가 → "ai_summary"
    learning_mode = "watch" if is_playable else "ai_summary"

    return {
        "contents_slno": raw["contentsSlno"],
        "title": raw["title"],
        "summary": raw.get("smrtnCntnt", ""),
        "provider_code": provider_code,
        "provider_name": PROVIDER_NAMES.get(provider_code, "기타 기관"),
        "make_type_code": make_type_code,
        "make_type_name": MAKE_TYPE_NAMES.get(make_type_code, "기타"),
        "target_code": target_code,
        "target_name": TARGET_NAMES.get(target_code, "전체"),
        "topic_code": raw.get("eduCntnt", ""),
        "url": url,
        "external_url": external_url or None,
        "file_down_url": file_down_url or None,
        "playtime": playtime,
        "producing_yr": raw.get("producingYr", ""),
        "copyright_code": raw.get("cpyrhtPermCode", ""),
        # v2.10 신규
        "is_playable": is_playable,
        "learning_mode": learning_mode,    # "watch" | "ai_summary"
        "playable_reason": playable_reason,
    }


# ============================================================
# 엔드포인트: 루트 (프론트엔드)
# ============================================================
STATIC_DIR = ROOT / "static"


@app.get("/")
async def root():
    """랜딩 페이지 (정적 HTML)"""
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"message": "SafeInvest AI Demo", "docs": "/docs"}


# 정적 파일 서빙
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ============================================================
# 엔드포인트: 교육 센터 API
# ============================================================

@app.get("/api/education/topics", tags=["교육 센터"])
async def list_topics(category: Optional[str] = None):
    """
    교육 주제 카테고리 목록

    - category: 필터 (Level 1~4 또는 인생 단계별)
    - 실데이터(SAMPLE_CONTENTS) 기반으로 content_count 자동 갱신
    """
    # 실데이터에서 주제별 실제 콘텐츠 수 계산
    from data.mock_data import SAMPLE_CONTENTS
    real_counts = {code: len(contents) for code, contents in SAMPLE_CONTENTS.items()}

    # 주제별 content_count 및 has_real_data 동적 갱신
    topics_with_counts = []
    for t in TOPIC_CATEGORIES:
        t_copy = dict(t)
        actual_count = real_counts.get(t["code"], 0)
        if actual_count > 0:
            t_copy["content_count"] = actual_count
            t_copy["has_real_data"] = True
        else:
            # 실데이터 없으면 0으로 명시 (혼란 방지)
            t_copy["content_count"] = 0
            t_copy["has_real_data"] = False
        topics_with_counts.append(t_copy)

    # 필터링
    if category:
        filtered = [t for t in topics_with_counts if t["category"] == category]
    else:
        filtered = topics_with_counts

    # 카테고리별 그룹화 (level_order 순으로 정렬)
    categories = {}
    for topic in filtered:
        cat = topic["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(topic)

    # 각 카테고리 내에서 실데이터 있는 것 먼저 정렬
    for cat in categories:
        categories[cat].sort(key=lambda x: (-x.get("content_count", 0), x["code"]))

    return {
        "total": len(filtered),
        "categories": categories,
        "all_topics": filtered,
    }


@app.get("/api/education/topics/{topic_code}", tags=["교육 센터"])
async def get_topic_detail(topic_code: str, target: Optional[str] = None):
    """
    특정 주제의 콘텐츠 목록
    
    - topic_code: 교육 주제 코드 (예: 2002)
    - target: 교육대상 필터 (Y, A, U 등)
    """
    # 주제 정보
    topic_info = next(
        (t for t in TOPIC_CATEGORIES if t["code"] == topic_code), None
    )
    if not topic_info:
        raise HTTPException(404, f"주제 {topic_code}을(를) 찾을 수 없습니다")

    # 콘텐츠 조회
    raw_contents = SAMPLE_CONTENTS.get(topic_code, [])

    # 타겟 필터
    if target:
        raw_contents = [c for c in raw_contents if c.get("eduTrgtCntnt") == target]

    contents = [enrich_content(c) for c in raw_contents]

    return {
        "topic": topic_info,
        "contents_count": len(contents),
        "contents": contents,
    }


@app.get("/api/education/contents/{slno}", tags=["교육 센터"])
async def get_content_detail(slno: str):
    """개별 콘텐츠 상세 정보"""
    for topic_code, contents in SAMPLE_CONTENTS.items():
        for c in contents:
            if c["contentsSlno"] == slno:
                enriched = enrich_content(c)
                # 같은 주제의 다른 콘텐츠 추천
                related = [
                    enrich_content(other)
                    for other in contents
                    if other["contentsSlno"] != slno
                ][:3]
                return {
                    "content": enriched,
                    "related": related,
                }
    raise HTTPException(404, f"콘텐츠 {slno}을(를) 찾을 수 없습니다")


# ============================================================
# 엔드포인트: 챗봇 API
# ============================================================

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)
    user_age: int = Field(default=28, ge=10, le=100)


class ChatSource(BaseModel):
    contents_slno: str
    title: str
    provider_name: str
    make_type_name: str
    url: Optional[str]
    playtime: Optional[str]


class ChatResponse(BaseModel):
    question: str
    answer: str
    answer_source: str = Field("mock", description="답변 생성 소스: 'openai' 또는 'mock'")
    matched_topic: Optional[dict]
    sources: list[ChatSource]
    disclaimer: str
    fallback_used: bool


@app.post("/api/chat/ask", response_model=ChatResponse, tags=["챗봇"])
async def chat_ask(req: ChatRequest):
    """
    챗봇 질문 답변
    
    처리 흐름:
    1. 질문 주제 매칭
    2. 관련 교육 자료 추천
    3. LLM 답변 생성 (OPENAI_API_KEY 있으면 실제 호출, 없으면 Mock)
    """
    from app.llm import generate_answer

    # Step 1: 주제 매칭
    topic_match = match_topic(req.question)

    if not topic_match["code"]:
        return ChatResponse(
            question=req.question,
            answer=(
                "죄송합니다, 해당 질문은 저희 교육 주제 범위를 벗어납니다. "
                "예금, 투자, 분산투자, 위험관리, 노후준비 등 금융 교육 주제에 대해 질문해주세요."
            ),
            answer_source="mock",
            matched_topic=None,
            sources=[],
            disclaimer="🛡️ 본 답변은 금융감독원 공식 교육 자료를 참고합니다.",
            fallback_used=True,
        )

    topic_code = topic_match["code"]
    topic_info = next(t for t in TOPIC_CATEGORIES if t["code"] == topic_code)

    # Step 2: 해당 주제의 콘텐츠에서 추천 3건 선택
    target_code = age_to_target(req.user_age)
    raw_contents = SAMPLE_CONTENTS.get(topic_code, [])

    # 타겟 우선 필터 + 없으면 전체
    target_matched = [c for c in raw_contents if c.get("eduTrgtCntnt") == target_code]
    recommendations = target_matched[:3] if target_matched else raw_contents[:3]

    enriched_recs = [enrich_content(c) for c in recommendations]

    sources = [
        ChatSource(
            contents_slno=e["contents_slno"],
            title=e["title"],
            provider_name=e["provider_name"],
            make_type_name=e["make_type_name"],
            url=e["url"],
            playtime=e["playtime"],
        )
        for e in enriched_recs
    ]

    # Step 3: LLM 답변 생성 (실제 호출 or Mock)
    answer, source = generate_answer(
        question=req.question,
        topic_code=topic_code,
        topic_name=topic_info["name"],
        sources=[
            {
                "title": e["title"],
                "summary": e["summary"],
                "provider_name": e["provider_name"],
            }
            for e in enriched_recs
        ],
        mock_answers=MOCK_LLM_ANSWERS,
    )

    return ChatResponse(
        question=req.question,
        answer=answer,
        answer_source=source,
        matched_topic={
            "code": topic_code,
            "name": topic_info["name"],
            "confidence": topic_match["confidence"],
            "matched_keywords": topic_match["matched_keywords"],
        },
        sources=sources,
        disclaimer=(
            "🛡️ 본 답변은 금융감독원 e-금융교육센터 공식 교육 자료를 참고합니다. "
            "투자 판단과 결과에 대한 책임은 본인에게 있습니다."
        ),
        fallback_used=False,
    )


# ============================================================
# 컨텍스트 챗봇 (콘텐츠 시청 중 질문)
# ============================================================

class ContextualChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    content_slno: str = Field(..., description="현재 시청 중인 콘텐츠 slno")
    user_age: int = Field(default=28, ge=10, le=100)


class SuggestedQuestionsResponse(BaseModel):
    content_slno: str
    questions: list[str]
    source: str = Field(description="'openai' | 'fallback'")


def _find_content_by_slno(slno: str) -> tuple[Optional[dict], Optional[str]]:
    """slno로 콘텐츠 찾기 → (enriched_content, topic_code) 반환

    금감원 콘텐츠 + 자체 콘텐츠 모두 검색.
    """
    # 1. 자체 콘텐츠 (✨ 기본기) 먼저 확인 — slno가 self_로 시작
    if str(slno).startswith("self_"):
        from data.self_contents import get_content_by_slno, SELF_CATEGORIES

        c = get_content_by_slno(slno)
        if c:
            cat_map = {cat["code"]: cat for cat in SELF_CATEGORIES}
            cat = cat_map.get(c.get("category_code"))
            return {
                "contents_slno": c["contents_slno"],
                "title": c["title"],
                "summary": c["summary"] + (
                    " | 학습 포인트: " + " / ".join(c["learning_objectives"])
                    if c.get("learning_objectives") else ""
                ),
                "make_type_code": "9",
                "make_type_name": "SafeInvest 영상",
                "provider_name": "SafeInvest AI",
                "topic_code": c.get("category_code", ""),
                "is_self_content": True,
            }, c.get("category_code", "self")

    # 2. 금감원 콘텐츠 검색
    for topic_code, contents in SAMPLE_CONTENTS.items():
        for c in contents:
            if c["contentsSlno"] == slno:
                return enrich_content(c), topic_code
    return None, None


@app.get("/api/education/contents/{slno}/suggested-questions",
         response_model=SuggestedQuestionsResponse, tags=["챗봇"])
async def get_suggested_questions(slno: str):
    """콘텐츠별 추천 질문 3개 (LLM 자동 생성 + 캐싱)
    
    금감원 콘텐츠 + 자체 콘텐츠 (✨ 기본기) 모두 지원.
    """
    from app.llm import generate_suggested_questions, get_llm_mode

    current, topic_code = _find_content_by_slno(slno)
    if not current:
        raise HTTPException(404, f"콘텐츠 {slno}을(를) 찾을 수 없습니다")

    # 토픽 이름 결정 (자체 콘텐츠 vs 금감원 콘텐츠)
    if current.get("is_self_content"):
        from data.self_contents import SELF_CATEGORIES
        cat_map = {c["code"]: c for c in SELF_CATEGORIES}
        cat = cat_map.get(topic_code)
        topic_name = cat["name"] if cat else "기본기"
    else:
        topic_info = next(
            (t for t in TOPIC_CATEGORIES if t["code"] == topic_code),
            {"name": "금융 교육"},
        )
        topic_name = topic_info["name"]

    questions = generate_suggested_questions(
        content_slno=slno,
        content_title=current["title"],
        content_summary=current.get("summary", ""),
        topic_name=topic_name,
    )

    return SuggestedQuestionsResponse(
        content_slno=slno,
        questions=questions,
        source=get_llm_mode() if get_llm_mode() == "openai" else "fallback",
    )


@app.post("/api/chat/contextual", response_model=ChatResponse, tags=["챗봇"])
async def chat_contextual(req: ContextualChatRequest):
    """
    컨텍스트 인식 챗봇 — 현재 보고 있는 콘텐츠 기반 답변
    
    "이게 뭐예요?" 같은 짧은 질문도 콘텐츠 맥락으로 이해
    """
    from app.llm import generate_contextual_answer

    # 1. 현재 콘텐츠 찾기
    current, content_topic_code = _find_content_by_slno(req.content_slno)
    if not current:
        raise HTTPException(404, f"콘텐츠 {req.content_slno}을(를) 찾을 수 없습니다")

    # 2. 질문 주제 매칭 (맥락 포함)
    enriched_question = f"{req.question} (콘텐츠: {current['title']})"
    topic_match = match_topic(enriched_question)

    # 매칭 실패 시 콘텐츠의 주제 사용
    topic_code = topic_match["code"] or content_topic_code
    topic_info = next(
        (t for t in TOPIC_CATEGORIES if t["code"] == topic_code),
        {"name": "금융 교육", "code": topic_code},
    )

    # 3. 관련 자료 추천 (현재 콘텐츠 제외하고 3개)
    target_code = age_to_target(req.user_age)
    raw_contents = SAMPLE_CONTENTS.get(topic_code, [])

    # 현재 콘텐츠 제외
    other_contents = [c for c in raw_contents if c["contentsSlno"] != req.content_slno]

    # 타겟 우선 필터
    target_matched = [c for c in other_contents if c.get("eduTrgtCntnt") == target_code]
    recommendations = target_matched[:3] if target_matched else other_contents[:3]

    enriched_recs = [enrich_content(c) for c in recommendations]

    sources = [
        ChatSource(
            contents_slno=e["contents_slno"],
            title=e["title"],
            provider_name=e["provider_name"],
            make_type_name=e["make_type_name"],
            url=e["url"],
            playtime=e["playtime"],
        )
        for e in enriched_recs
    ]

    # 4. 컨텍스트 인식 LLM 답변 생성
    answer, source = generate_contextual_answer(
        question=req.question,
        topic_code=topic_code,
        topic_name=topic_info["name"],
        sources=[
            {
                "title": e["title"],
                "summary": e["summary"],
                "provider_name": e["provider_name"],
            }
            for e in enriched_recs
        ],
        current_content=current,
        mock_answers=MOCK_LLM_ANSWERS,
    )

    return ChatResponse(
        question=req.question,
        answer=answer,
        answer_source=source,
        matched_topic={
            "code": topic_code,
            "name": topic_info["name"],
            "confidence": topic_match["confidence"] if topic_match["code"] else 0.5,
            "matched_keywords": topic_match["matched_keywords"],
            "context_content": current["title"],  # 컨텍스트로 사용된 콘텐츠
        },
        sources=sources,
        disclaimer=(
            f"💡 '{current['title']}' 콘텐츠 맥락을 반영한 답변입니다. "
            "🛡️ 투자 판단과 결과에 대한 책임은 본인에게 있습니다."
        ),
        fallback_used=False,
    )


# ============================================================
# 엔드포인트: 헬스체크 & 메타
# ============================================================

@app.get("/api/health", tags=["메타"])
async def health():
    """서비스 상태 확인"""
    from app.llm import get_llm_info
    return {
        "status": "healthy",
        "version": "2.0-demo",
        "data_source": "Mock (실제 금감원 API 응답 구조 기반)",
        "total_topics": len(TOPIC_CATEGORIES),
        "total_sample_contents": sum(len(v) for v in SAMPLE_CONTENTS.values()),
        "llm": get_llm_info(),
    }


@app.get("/api/meta/categories", tags=["메타"])
async def get_categories():
    """카테고리 목록"""
    cats = list(set(t["category"] for t in TOPIC_CATEGORIES))
    return {"categories": cats}


# ============================================================
# 엔드포인트: 자체 콘텐츠 (✨ 기본기 탭)
# ============================================================
# SafeInvest AI 자체 제작 콘텐츠. 학습경로/교육센터와 분리된 별도 탭.

@app.get("/api/self-contents", tags=["기본기"])
async def list_self_contents(category: Optional[str] = None):
    """
    자체 콘텐츠 목록 조회.

    Query:
        category: 카테고리 코드 필터 (A, B, C, D, E). 없으면 전체.
    """
    from data.self_contents import get_all_contents, get_contents_by_category, SELF_CATEGORIES

    if category:
        contents = get_contents_by_category(category)
    else:
        contents = get_all_contents()

    # 카테고리 정보를 함께 응답
    cat_map = {c["code"]: c for c in SELF_CATEGORIES}
    enriched = []
    for c in contents:
        cat = cat_map.get(c.get("category_code"))
        enriched.append({
            **c,
            "category_name": cat["name"] if cat else "기타",
            "category_icon": cat["icon"] if cat else "📌",
        })

    return {
        "categories": SELF_CATEGORIES,
        "contents": enriched,
        "total": len(enriched),
    }


@app.get("/api/self-contents/{slno}", tags=["기본기"])
async def get_self_content(slno: str):
    """
    자체 콘텐츠 단일 조회 (상세 페이지용).
    AI 챗봇은 /api/chat/contextual 엔드포인트를 그대로 활용.
    """
    from data.self_contents import get_content_by_slno, SELF_CATEGORIES

    content = get_content_by_slno(slno)
    if not content:
        raise HTTPException(status_code=404, detail="자체 콘텐츠를 찾을 수 없습니다.")

    # 카테고리 정보 보강
    cat_map = {c["code"]: c for c in SELF_CATEGORIES}
    cat = cat_map.get(content.get("category_code"))

    # 콘텐츠 상세 페이지 호환 형식으로 반환
    return {
        "content": {
            **content,
            "category_name": cat["name"] if cat else "기타",
            "category_icon": cat["icon"] if cat else "📌",
            # 기존 콘텐츠 상세 페이지와 호환되는 필드
            "make_type_code": "9",
            "make_type_name": "SafeInvest 영상",
            "provider_name": "SafeInvest AI",
            "target_name": "전체",
            "playtime": f"{content['playtime_minutes']}분",
            "url": content["video_path"],
            "external_url": None,
            "file_down_url": None,
            "is_playable": True,
            "learning_mode": "watch",
            "is_self_content": True,    # 자체 콘텐츠 표시 (프론트엔드용)
        },
        "related": [],  # 관련 콘텐츠는 일단 없음
    }


@app.get("/api/self-contents/{slno}/suggested-questions", tags=["기본기"])
async def get_self_content_suggested_questions(slno: str):
    """자체 콘텐츠에 대한 추천 질문 (AI 튜터 사이드 챗봇용)."""
    from data.self_contents import get_content_by_slno, SELF_CATEGORIES
    from app.llm import generate_suggested_questions

    content = get_content_by_slno(slno)
    if not content:
        raise HTTPException(status_code=404, detail="자체 콘텐츠를 찾을 수 없습니다.")

    cat_map = {c["code"]: c for c in SELF_CATEGORIES}
    cat = cat_map.get(content.get("category_code"))
    cat_name = cat["name"] if cat else "기본기"

    # 학습 목표를 요약에 추가하여 더 정확한 추천 질문 생성
    summary = content["summary"]
    if content.get("learning_objectives"):
        summary = summary + " | 학습 포인트: " + " / ".join(content["learning_objectives"])

    questions = generate_suggested_questions(
        content_slno=slno,
        content_title=content["title"],
        content_summary=summary,
        topic_name=cat_name,
    )

    return {"questions": questions, "from_cache": False}


# ============================================================
# 실행 (직접 실행 시)
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
