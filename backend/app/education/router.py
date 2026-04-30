"""
교육 센터 라우터
education/app/main.py의 API 엔드포인트를 FastAPI APIRouter로 통합
"""
import re

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
from pathlib import Path

from .data.mock_data import TOPIC_CATEGORIES, SAMPLE_CONTENTS, MOCK_LLM_ANSWERS
from .matcher import match_topic, age_to_target
from .curriculum import router as curriculum_router
from .fss_proxy import router as fss_proxy_router

router = APIRouter(prefix="/api/education", tags=["교육 센터"])

# 하위 라우터 포함 (main.py에서 include 후 이 router에 연결)
sub_routers = [curriculum_router, fss_proxy_router]

# ============================================================
# 매핑 테이블
# ============================================================
PROVIDER_NAMES = {
    "1": "금융감독원", "2": "서민금융진흥원", "9": "은행연합회",
    "10": "예금보험공사", "13": "투자자교육협의회", "15": "금융투자협회",
    "32": "한국예탁결제원", "33": "한국거래소", "44": "국민연금공단",
}
MAKE_TYPE_NAMES = {
    "1": "영상/애니메이션", "2": "도서", "3": "웹툰/만화",
    "5": "체험형 교구", "6": "카드뉴스", "7": "웹진/잡지", "8": "오디오북",
}
TARGET_NAMES = {
    "P": "아동기", "H": "청소년기", "Y": "청년기", "A": "중장년기",
    "R": "노년기", "U": "대학생", "AM": "군장병",
}


def _check_playable(make_type_code: str, external_url: str, file_down_url: str) -> tuple[bool, str]:
    access = _classify_access(make_type_code, external_url, file_down_url)
    return access["is_playable"], access["playable_reason"]


def _classify_access(make_type_code: str, external_url: str, file_down_url: str) -> dict:
    """콘텐츠 접근 유형을 더 보수적으로 분류한다."""
    ext = (external_url or "").strip()
    ext_lower = ext.lower()
    file_url = (file_down_url or "").strip()

    def _looks_like_inline_media(url: str) -> bool:
        return bool(re.search(r"\.(mp4|webm|ogg|mov|m4v)(\?|#|$)", url, re.IGNORECASE))

    if make_type_code == "1":
        if "youtu" in ext_lower:
            return {"is_playable": True, "learning_mode": "watch", "access_type": "youtube", "playable_reason": "youtube"}
        if _looks_like_inline_media(ext_lower):
            return {"is_playable": True, "learning_mode": "watch", "access_type": "direct_video", "playable_reason": "direct_video"}
        if ext_lower.startswith("http") and "fss.or.kr" not in ext_lower and "vod" not in ext_lower:
            return {"is_playable": False, "learning_mode": "open", "access_type": "external_page", "playable_reason": "external_page"}
        return {"is_playable": False, "learning_mode": "ai_summary", "access_type": "blocked", "playable_reason": "fss_vod_blocked"}

    if make_type_code == "2":
        if file_url:
            return {"is_playable": False, "learning_mode": "open", "access_type": "file_resource", "playable_reason": "file_resource"}
        return {"is_playable": False, "learning_mode": "ai_summary", "access_type": "missing", "playable_reason": "no_file"}

    if make_type_code == "3":
        if ext_lower and "fss.or.kr" in ext_lower:
            return {"is_playable": False, "learning_mode": "ai_summary", "access_type": "blocked", "playable_reason": "webtoon_iframe_blocked"}
        if ext:
            return {"is_playable": False, "learning_mode": "open", "access_type": "external_webtoon", "playable_reason": "external_webtoon"}
        return {"is_playable": False, "learning_mode": "ai_summary", "access_type": "missing", "playable_reason": "no_url"}

    if make_type_code == "8":
        if ext or file_url:
            return {"is_playable": True, "learning_mode": "watch", "access_type": "audio", "playable_reason": "audio"}
        return {"is_playable": False, "learning_mode": "ai_summary", "access_type": "missing", "playable_reason": "no_url"}

    if make_type_code in ("4", "5", "6", "7"):
        if ext or file_url:
            return {"is_playable": False, "learning_mode": "open", "access_type": f"type_{make_type_code}", "playable_reason": f"type_{make_type_code}"}
        return {"is_playable": False, "learning_mode": "ai_summary", "access_type": "missing", "playable_reason": "no_url"}

    if ext or file_url:
        return {"is_playable": False, "learning_mode": "open", "access_type": "unknown_resource", "playable_reason": "unknown_resource"}

    return {"is_playable": False, "learning_mode": "ai_summary", "access_type": "unknown", "playable_reason": "unknown"}


def enrich_content(raw: dict) -> dict:
    provider_code = str(raw.get("fncEngnCode", ""))
    make_type_code = str(raw.get("makeTypeCode", ""))
    target_code = str(raw.get("eduTrgtCntnt", ""))
    play_min = raw.get("playCntnMi", "")
    playtime = f"{play_min}분" if play_min else None
    external_url = raw.get("xtrnlContentsUrl") or ""
    file_down_url = raw.get("fileDownUrl") or ""
    if make_type_code in ("1", "8", "3", "5"):
        url = external_url or file_down_url
    else:
        url = file_down_url or external_url
    if not url:
        url = None
    access = _classify_access(make_type_code, external_url, file_down_url)
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
        "is_playable": access["is_playable"],
        "learning_mode": access["learning_mode"],
        "access_type": access["access_type"],
        "playable_reason": access["playable_reason"],
    }


def _find_content_by_slno(slno: str):
    if str(slno).startswith("self_"):
        from .data.self_contents import get_content_by_slno, SELF_CATEGORIES
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
    for topic_code, contents in SAMPLE_CONTENTS.items():
        for c in contents:
            if c["contentsSlno"] == slno:
                return enrich_content(c), topic_code
    return None, None


# ============================================================
# 교육 주제
# ============================================================
@router.get("/topics", summary="교육 주제 목록")
async def list_topics(category: Optional[str] = None):
    real_counts = {code: len(contents) for code, contents in SAMPLE_CONTENTS.items()}
    topics_with_counts = []
    for t in TOPIC_CATEGORIES:
        t_copy = dict(t)
        actual_count = real_counts.get(t["code"], 0)
        t_copy["content_count"] = actual_count
        t_copy["has_real_data"] = actual_count > 0
        topics_with_counts.append(t_copy)
    if category:
        filtered = [t for t in topics_with_counts if t["category"] == category]
    else:
        filtered = topics_with_counts
    categories: dict = {}
    for topic in filtered:
        cat = topic["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(topic)
    for cat in categories:
        categories[cat].sort(key=lambda x: (-x.get("content_count", 0), x["code"]))
    return {"total": len(filtered), "categories": categories, "all_topics": filtered}


@router.get("/topics/{topic_code}", summary="주제 콘텐츠 목록")
async def get_topic_detail(topic_code: str, target: Optional[str] = None):
    from fastapi import HTTPException
    topic_info = next((t for t in TOPIC_CATEGORIES if t["code"] == topic_code), None)
    if not topic_info:
        raise HTTPException(404, f"주제 {topic_code}을(를) 찾을 수 없습니다")
    raw_contents = SAMPLE_CONTENTS.get(topic_code, [])
    if target:
        raw_contents = [c for c in raw_contents if c.get("eduTrgtCntnt") == target]
    contents = [enrich_content(c) for c in raw_contents]
    return {"topic": topic_info, "contents_count": len(contents), "contents": contents}


@router.get("/contents/{slno}", summary="콘텐츠 상세")
async def get_content_detail(slno: str):
    from fastapi import HTTPException
    for topic_code, contents in SAMPLE_CONTENTS.items():
        for c in contents:
            if c["contentsSlno"] == slno:
                enriched = enrich_content(c)
                related = [enrich_content(other) for other in contents if other["contentsSlno"] != slno][:3]
                return {"content": enriched, "related": related}
    raise HTTPException(404, f"콘텐츠 {slno}을(를) 찾을 수 없습니다")


@router.get("/contents/{slno}/suggested-questions", summary="추천 질문")
async def get_suggested_questions(slno: str):
    from fastapi import HTTPException
    from .llm import generate_suggested_questions, get_llm_mode
    current, topic_code = _find_content_by_slno(slno)
    if not current:
        raise HTTPException(404, f"콘텐츠 {slno}을(를) 찾을 수 없습니다")
    if current.get("is_self_content"):
        from .data.self_contents import SELF_CATEGORIES
        cat_map = {c["code"]: c for c in SELF_CATEGORIES}
        cat = cat_map.get(topic_code)
        topic_name = cat["name"] if cat else "기본기"
    else:
        topic_info = next((t for t in TOPIC_CATEGORIES if t["code"] == topic_code), {"name": "금융 교육"})
        topic_name = topic_info["name"]
    questions = generate_suggested_questions(
        content_slno=slno, content_title=current["title"],
        content_summary=current.get("summary", ""), topic_name=topic_name,
    )
    source = get_llm_mode() if get_llm_mode() == "openai" else "fallback"
    return {"content_slno": slno, "questions": questions, "source": source}


# ============================================================
# 챗봇
# ============================================================
class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)
    user_age: int = Field(default=28, ge=10, le=100)


class ContextualChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    content_slno: str
    user_age: int = Field(default=28, ge=10, le=100)


@router.post("/chat/ask", summary="교육 챗봇 질문")
async def chat_ask(req: ChatRequest):
    from .llm import generate_answer
    topic_match = match_topic(req.question)
    if not topic_match["code"]:
        return {
            "question": req.question,
            "answer": "죄송합니다, 해당 질문은 교육 주제 범위를 벗어납니다. 예금, 투자, 분산투자, 위험관리, 노후준비 등 금융 교육 주제에 대해 질문해주세요.",
            "answer_source": "mock", "matched_topic": None, "sources": [],
            "disclaimer": "🛡️ 본 답변은 금융감독원 공식 교육 자료를 참고합니다.",
            "fallback_used": True,
        }
    topic_code = topic_match["code"]
    topic_info = next(t for t in TOPIC_CATEGORIES if t["code"] == topic_code)
    target_code = age_to_target(req.user_age)
    raw_contents = SAMPLE_CONTENTS.get(topic_code, [])
    target_matched = [c for c in raw_contents if c.get("eduTrgtCntnt") == target_code]
    recommendations = target_matched[:3] if target_matched else raw_contents[:3]
    enriched_recs = [enrich_content(c) for c in recommendations]
    sources = [{"contents_slno": e["contents_slno"], "title": e["title"],
                "provider_name": e["provider_name"], "make_type_name": e["make_type_name"],
                "url": e["url"], "playtime": e["playtime"]} for e in enriched_recs]
    answer, source = generate_answer(
        question=req.question, topic_code=topic_code, topic_name=topic_info["name"],
        sources=[{"title": e["title"], "summary": e["summary"], "provider_name": e["provider_name"]} for e in enriched_recs],
        mock_answers=MOCK_LLM_ANSWERS,
    )
    return {
        "question": req.question, "answer": answer, "answer_source": source,
        "matched_topic": {"code": topic_code, "name": topic_info["name"],
                          "confidence": topic_match["confidence"], "matched_keywords": topic_match["matched_keywords"]},
        "sources": sources,
        "disclaimer": "🛡️ 본 답변은 금융감독원 e-금융교육센터 공식 교육 자료를 참고합니다. 투자 판단과 결과에 대한 책임은 본인에게 있습니다.",
        "fallback_used": False,
    }


@router.post("/chat/contextual", summary="컨텍스트 챗봇")
async def chat_contextual(req: ContextualChatRequest):
    from fastapi import HTTPException
    from .llm import generate_contextual_answer
    current, content_topic_code = _find_content_by_slno(req.content_slno)
    if not current:
        raise HTTPException(404, f"콘텐츠 {req.content_slno}을(를) 찾을 수 없습니다")
    enriched_question = f"{req.question} (콘텐츠: {current['title']})"
    topic_match = match_topic(enriched_question)
    topic_code = topic_match["code"] or content_topic_code
    topic_info = next((t for t in TOPIC_CATEGORIES if t["code"] == topic_code), {"name": "금융 교육", "code": topic_code})
    target_code = age_to_target(req.user_age)
    raw_contents = SAMPLE_CONTENTS.get(topic_code, [])
    other_contents = [c for c in raw_contents if c["contentsSlno"] != req.content_slno]
    target_matched = [c for c in other_contents if c.get("eduTrgtCntnt") == target_code]
    recommendations = target_matched[:3] if target_matched else other_contents[:3]
    enriched_recs = [enrich_content(c) for c in recommendations]
    sources = [{"contents_slno": e["contents_slno"], "title": e["title"],
                "provider_name": e["provider_name"], "make_type_name": e["make_type_name"],
                "url": e["url"], "playtime": e["playtime"]} for e in enriched_recs]
    answer, source = generate_contextual_answer(
        question=req.question, topic_code=topic_code, topic_name=topic_info["name"],
        sources=[{"title": e["title"], "summary": e["summary"], "provider_name": e["provider_name"]} for e in enriched_recs],
        current_content=current, mock_answers=MOCK_LLM_ANSWERS,
    )
    return {
        "question": req.question, "answer": answer, "answer_source": source,
        "matched_topic": {"code": topic_code, "name": topic_info["name"],
                          "confidence": topic_match["confidence"] if topic_match["code"] else 0.5,
                          "matched_keywords": topic_match["matched_keywords"],
                          "context_content": current["title"]},
        "sources": sources,
        "disclaimer": f"💡 '{current['title']}' 콘텐츠 맥락을 반영한 답변입니다. 🛡️ 투자 판단과 결과에 대한 책임은 본인에게 있습니다.",
        "fallback_used": False,
    }


# ============================================================
# 자체 콘텐츠 (기본기)
# ============================================================
self_router = APIRouter(prefix="/api/self-contents", tags=["기본기"])


@self_router.get("", summary="자체 콘텐츠 목록")
async def list_self_contents(category: Optional[str] = None):
    from .data.self_contents import get_all_contents, get_contents_by_category, SELF_CATEGORIES
    contents = get_contents_by_category(category) if category else get_all_contents()
    cat_map = {c["code"]: c for c in SELF_CATEGORIES}
    enriched = []
    for c in contents:
        cat = cat_map.get(c.get("category_code"))
        enriched.append({**c, "category_name": cat["name"] if cat else "기타",
                         "category_icon": cat["icon"] if cat else "📌"})
    return {"categories": SELF_CATEGORIES, "contents": enriched, "total": len(enriched)}


@self_router.get("/{slno}", summary="자체 콘텐츠 상세")
async def get_self_content(slno: str):
    from fastapi import HTTPException
    from .data.self_contents import get_content_by_slno, SELF_CATEGORIES
    content = get_content_by_slno(slno)
    if not content:
        raise HTTPException(404, "자체 콘텐츠를 찾을 수 없습니다.")
    cat_map = {c["code"]: c for c in SELF_CATEGORIES}
    cat = cat_map.get(content.get("category_code"))
    return {
        "content": {
            **content,
            "category_name": cat["name"] if cat else "기타",
            "category_icon": cat["icon"] if cat else "📌",
            "make_type_code": "9", "make_type_name": "SafeInvest 영상",
            "provider_name": "SafeInvest AI", "target_name": "전체",
            "playtime": f"{content['playtime_minutes']}분",
            "url": content["video_path"], "external_url": None, "file_down_url": None,
            "is_playable": True, "learning_mode": "watch", "is_self_content": True,
        },
        "related": [],
    }


@self_router.get("/{slno}/suggested-questions", summary="자체 콘텐츠 추천 질문")
async def get_self_content_suggested_questions(slno: str):
    from fastapi import HTTPException
    from .data.self_contents import get_content_by_slno, SELF_CATEGORIES
    from .llm import generate_suggested_questions
    content = get_content_by_slno(slno)
    if not content:
        raise HTTPException(404, "자체 콘텐츠를 찾을 수 없습니다.")
    cat_map = {c["code"]: c for c in SELF_CATEGORIES}
    cat = cat_map.get(content.get("category_code"))
    cat_name = cat["name"] if cat else "기본기"
    summary = content["summary"]
    if content.get("learning_objectives"):
        summary = summary + " | 학습 포인트: " + " / ".join(content["learning_objectives"])
    questions = generate_suggested_questions(
        content_slno=slno, content_title=content["title"],
        content_summary=summary, topic_name=cat_name,
    )
    return {"questions": questions, "from_cache": False}
