"""
학습 경로 API (Learning Path / Curriculum)

제공 엔드포인트:
- POST /api/education/curriculum/match   - 설문 → 추천 경로 리스트
- GET  /api/education/curriculum/{path_id} - 경로 상세 (콘텐츠 hydrated)
- POST /api/education/curriculum/{path_id}/start - 학습 시작
- POST /api/education/curriculum/{path_id}/content/{slno}/complete - 완료 체크
- GET  /api/education/curriculum/progress - 내 진도 전체 조회

데모 단계:
- 사용자 상태는 메모리 저장 (in-memory dict)
- W2에 Supabase user_progress 테이블로 이관

LLM 활용:
- 매칭 결과에 "왜 이 경로가 추천되는지" 설명 추가 (1회 생성 + 캐시)
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from data.learning_paths import LEARNING_PATHS, match_learning_paths, get_path_by_id


router = APIRouter(prefix="/api/education/curriculum", tags=["학습 경로"])


# ============================================================
# 인메모리 저장소 (데모용)
# 실서비스에선 Supabase로 교체
# ============================================================
class _InMemoryStorage:
    """데모용 in-memory 진도 저장소"""

    def __init__(self):
        self.user_paths: dict[str, dict] = {}  # user_id → {path_id, started_at, completed_contents: []}
        self.path_explanations: dict[str, str] = {}  # cache key → LLM 설명

    def start_path(self, user_id: str, path_id: str):
        self.user_paths[user_id] = {
            "path_id": path_id,
            "completed_contents": set(),
            "started_at": "2026-04-22T10:00:00Z",  # 데모용 고정값
        }

    def get_progress(self, user_id: str) -> Optional[dict]:
        return self.user_paths.get(user_id)

    def mark_completed(self, user_id: str, content_slno: str):
        if user_id not in self.user_paths:
            return False
        self.user_paths[user_id]["completed_contents"].add(content_slno)
        return True

    def unmark_completed(self, user_id: str, content_slno: str):
        if user_id not in self.user_paths:
            return False
        self.user_paths[user_id]["completed_contents"].discard(content_slno)
        return True

    def toggle_completed(self, user_id: str, content_slno: str) -> bool:
        """완료 상태를 토글. 반환값: 토글 후 완료 여부 (True=완료됨, False=해제됨)"""
        if user_id not in self.user_paths:
            return False
        completed = self.user_paths[user_id]["completed_contents"]
        if content_slno in completed:
            completed.discard(content_slno)
            return False
        else:
            completed.add(content_slno)
            return True

    def get_completed(self, user_id: str) -> set:
        progress = self.user_paths.get(user_id)
        return progress["completed_contents"] if progress else set()


_storage = _InMemoryStorage()


# ============================================================
# Pydantic 모델
# ============================================================
class MatchRequest(BaseModel):
    # v2.10 신규: 단순화된 3문항 - 직접 입력 가능
    life_stage: Optional[str] = Field(
        default=None, pattern="^(teen|college|rookie|midcareer|preretire|retired|military|debt_crisis)$",
        description="인생 단계 (3문항 설문 첫번째 답)"
    )
    primary_concern: Optional[str] = Field(
        default=None, pattern="^(wealth|retirement|fraud|debt|literacy)$",
        description="주요 고민 (3문항 설문 두번째 답)"
    )

    # 기존 필드 (구 클라이언트/풍부한 설문 호환용)
    level: str = Field(default="beginner", pattern="^(beginner|intermediate|advanced)$")
    goals: list[str] = Field(default_factory=list, max_length=5)
    age: int = Field(default=30, ge=10, le=100)
    weekly_hours: int = Field(default=2, ge=1, le=20)
    age_group: Optional[str] = Field(
        default=None, pattern="^(H|U|Y|A|R)$",
        description="연령대 코드 (H=청소년, U=대학생, Y=청년, A=중장년, R=노년)"
    )
    financial_stage: Optional[str] = Field(
        default=None, pattern="^(starting|building|managing|protecting)$",
        description="재무 상황 단계"
    )
    urgency: Optional[str] = Field(
        default=None, pattern="^(urgent|problem|steady|curious)$",
        description="학습 동기/긴급도"
    )


class MatchedPath(BaseModel):
    id: str
    name: str
    subtitle: str
    duration_weeks: int
    weekly_hours: int
    total_contents: int
    target_level: str
    target_goals: list[str]
    match_score: float
    match_reasons: list[str]
    why_recommended: Optional[str] = None  # LLM이 생성한 개인화된 이유


class MatchResponse(BaseModel):
    user_profile: dict
    matched_paths: list[MatchedPath]


# ============================================================
# 엔드포인트: 매칭
# ============================================================
@router.post("/match", response_model=MatchResponse)
async def match_curriculum(req: MatchRequest):
    """
    사용자 프로파일에 맞는 학습 경로 매칭

    프로세스:
    1. 설문 답변을 인생 단계(life_stage) + 주요 고민(primary_concern)으로 변환
    2. 새 9개 학습경로 매칭 함수 호출
    3. 점수 계산 + 추천 이유 생성
    """
    # ─────────────────────────────────────────────
    # 어댑터: 기존 설문 답변 → 새 매칭 시그니처로 변환
    # ─────────────────────────────────────────────
    life_stage = _infer_life_stage(req)
    primary_concern = _infer_primary_concern(req)

    # 새 매칭 함수 호출
    matches = match_learning_paths(
        life_stage=life_stage,
        primary_concern=primary_concern,
        age=req.age,
        weekly_hours=req.weekly_hours,
        top_n=3,
    )

    # 추천 이유 생성
    matched = []
    for i, m in enumerate(matches):
        path = m["path"]
        score = m["score"]
        reasons = _generate_match_reasons(path, life_stage, primary_concern, req)

        why = None
        if i == 0:
            why = _generate_why_recommended(path, req, reasons)

        matched.append(MatchedPath(
            id=path["id"],
            name=path["name"],
            subtitle=path["subtitle"],
            duration_weeks=path["duration_weeks"],
            weekly_hours=path["weekly_hours"],
            total_contents=path["total_contents"],
            target_level=path["target_level"],
            target_goals=path["target_goals"],
            match_score=float(score),
            match_reasons=reasons,
            why_recommended=why,
        ))

    return MatchResponse(
        user_profile=req.model_dump(),
        matched_paths=matched,
    )


# ============================================================
# 카드 그리드 표시 순서 (학습 흐름 기반)
# ============================================================
# 1줄: 인생 시작 단계 (어린→성인)
# 2줄: 투자 학습 단계 (시작→본격→고급)
# 3줄: 자산·노후 (절세→50대→은퇴 후)
# 4줄: 위기·특수 대응 (사기/군/빚)
DISPLAY_ORDER = [
    "teen_first_finance_4w",       # ① 청소년
    "college_career_prep_4w",      # ② 대학생
    "rookie_first_year_6w",        # ③ 사회초년생
    "investing_first_steps_4w",    # ⑫ 투자 첫걸음
    "wealth_building_8w",          # ④ 본격 재테크
    "smart_investor_report_5w",    # ⑩ 리포트·산업 분석
    "tax_smart_investor_4w",       # ⑪ 절세 마스터
    "midlife_retire_check_6w",     # ⑤ 50대 노후
    "post_retire_4w",              # ⑥ 은퇴 후
    "fraud_defense_4w",            # ⑦ 금융사기
    "military_savings_4w",         # ⑧ 군장병
    "debt_escape_5w",              # ⑨ 빚 관리
]


@router.get("/paths")
async def list_all_paths():
    """
    12개 학습경로 전체 목록 (카드 그리드용).
    DISPLAY_ORDER 기반으로 학습 흐름이 자연스러운 순서로 정렬.
    """
    paths_by_id = {p["id"]: p for p in LEARNING_PATHS}

    result = []
    # 1) DISPLAY_ORDER 우선
    for pid in DISPLAY_ORDER:
        path = paths_by_id.get(pid)
        if not path:
            continue
        result.append(_path_to_card_dict(path))

    # 2) DISPLAY_ORDER에 없는 경로 (혹시 추가된 것) 뒤에 붙임
    for path in LEARNING_PATHS:
        if path["id"] not in DISPLAY_ORDER:
            result.append(_path_to_card_dict(path))

    return {"paths": result, "total": len(result)}


def _path_to_card_dict(path: dict) -> dict:
    """학습경로 정의 → 카드용 딕셔너리"""
    return {
        "id": path["id"],
        "name": path["name"],
        "subtitle": path.get("subtitle", ""),
        "tone": path.get("tone", ""),
        "target_audience": path.get("target_audience", []),
        "duration_weeks": path["duration_weeks"],
        "weekly_hours": path["weekly_hours"],
        "total_contents": path.get("total_contents", 0),
        "weeks": [
            {
                "week_number": w["week_number"],
                "theme": w.get("theme", ""),
            }
            for w in path.get("weeks", [])
        ],
    }


# ============================================================
# 어댑터: 기존 설문 답변 → 새 시그니처로 변환
# ============================================================
def _infer_life_stage(req: MatchRequest) -> str:
    """
    인생 단계 결정.

    우선순위:
      1. req.life_stage 직접 입력 (3문항 설문)
      2. age_group + financial_stage로 추정 (기존 7문항 설문)
      3. age로 추정 (최후)
    """
    # 1순위: 직접 입력
    if req.life_stage:
        return req.life_stage

    # 2/3순위: 기존 호환
    age_group = req.age_group
    age = req.age

    if age_group == "H" or (age_group is None and age < 19):
        return "teen"
    if age_group == "U" or (age_group is None and 19 <= age <= 23):
        return "college"
    if age_group == "R" or (age_group is None and age >= 65):
        return "retired"
    if age_group == "A" or (age_group is None and age >= 45):
        return "preretire"

    fs = req.financial_stage
    if fs in ("managing", "protecting"):
        return "midcareer"

    return "rookie"


def _infer_primary_concern(req: MatchRequest) -> Optional[str]:
    """
    주요 고민 결정.

    우선순위:
      1. req.primary_concern 직접 입력
      2. goals 리스트에서 추정
      3. urgency에서 추정
    """
    # 1순위: 직접 입력
    if req.primary_concern:
        return req.primary_concern

    # 2순위: goals
    goals = req.goals or []
    if "fraud_prevention" in goals or "financial_safety" in goals:
        return "fraud"
    if "wealth_building" in goals or "investment_start" in goals:
        return "wealth"
    if "retirement" in goals:
        return "retirement"
    if "financial_literacy" in goals:
        return "literacy"

    # 3순위: urgency
    if req.urgency == "urgent":
        return "wealth"

    return None


def _generate_match_reasons(
    path: dict,
    life_stage: str,
    primary_concern: Optional[str],
    req: MatchRequest,
) -> list[str]:
    """매칭 이유 텍스트 생성 (UI 표시용)"""
    reasons = []

    # 인생 단계 매칭
    stage_to_label = {
        "teen": "청소년",
        "college": "대학생",
        "rookie": "사회초년생",
        "midcareer": "직장인",
        "preretire": "은퇴 준비기",
        "retired": "은퇴 후",
        "military": "군 복무 중",
        "debt_crisis": "빚 관리 필요",
    }
    label = stage_to_label.get(life_stage, "")
    target_aud = path.get("target_audience", [])
    aud_label = {"H": "청소년", "C": "아동", "U": "대학생", "Y": "청년",
                 "A": "중장년", "R": "노년", "AM": "군장병", "F": "신용유의자"}
    target_names = [aud_label.get(t, t) for t in target_aud]
    if target_names:
        reasons.append(f"{label}을 위한 {' / '.join(target_names)} 대상 코스")

    # 주요 고민 매칭
    concern_label = {
        "fraud": "금융사기 예방",
        "wealth": "자산 형성·투자",
        "retirement": "노후 준비",
        "literacy": "기초 금융 학습",
        "debt": "빚 관리",
    }
    if primary_concern and primary_concern in concern_label:
        path_goals = path.get("target_goals", [])
        if any(g for g in path_goals if g != "financial_literacy"):
            reasons.append(f"{concern_label[primary_concern]} 중심 학습")

    # 시간 적합성
    path_hours = path.get("weekly_hours", 2)
    if abs(path_hours - req.weekly_hours) <= 1:
        reasons.append(f"주 {path_hours}시간 학습량")

    # 기간
    weeks = path.get("duration_weeks", 0)
    reasons.append(f"{weeks}주 완성 코스")

    return reasons


def _generate_why_recommended(path: dict, req: MatchRequest, reasons: list[str]) -> str:
    """
    LLM으로 "왜 이 경로가 추천되는지" 개인화된 설명 생성

    - 캐시 사용 (같은 프로파일 조합 → 동일 설명 재사용)
    - 실패 시 규칙 기반 설명으로 폴백
    """
    cache_key = (
        f"{path['id']}:{req.level}:{sorted(req.goals)}:{req.age // 10 * 10}"
        f":{req.financial_stage}:{req.urgency}"
    )

    if cache_key in _storage.path_explanations:
        return _storage.path_explanations[cache_key]

    # LLM 호출 (선택적)
    try:
        from app.llm import get_llm_mode
        if get_llm_mode() != "openai":
            # Mock 모드면 규칙 기반 설명
            return _fallback_why(path, req, reasons)

        import os
        from openai import OpenAI

        # 프로파일 정보 풍부화
        STAGE_LABELS = {
            "starting": "저축을 막 시작한",
            "building": "자산을 형성하고 있는",
            "managing": "자산을 체계적으로 관리하는",
            "protecting": "자산을 지키고 은퇴를 준비하는",
        }
        URGENCY_LABELS = {
            "urgent": "큰 금융 결정을 앞두고 급하게",
            "problem": "특정 문제를 해결하려고",
            "steady": "꾸준히 체계적으로",
            "curious": "교양 수준으로 관심있어",
        }

        profile_lines = [
            f"- 레벨: {req.level}",
            f"- 관심사: {', '.join(req.goals)}",
            f"- 나이: {req.age}세",
            f"- 주당 학습 가능 시간: {req.weekly_hours}시간",
        ]
        if req.financial_stage:
            profile_lines.append(f"- 재무 상황: {STAGE_LABELS.get(req.financial_stage, req.financial_stage)} 단계")
        if req.urgency:
            profile_lines.append(f"- 학습 동기: {URGENCY_LABELS.get(req.urgency, req.urgency)} 배우려는 상황")

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {
                    "role": "system",
                    "content": "당신은 금융 교육 상담사입니다. 사용자에게 학습 경로가 왜 적합한지 2~3문장으로 친근하게 설명해주세요. 단정적 표현 대신 '~에 도움이 됩니다' 같은 권유 어조를 사용하세요. 사용자의 재무 상황이나 학습 동기가 있다면 그것도 자연스럽게 반영해주세요.",
                },
                {
                    "role": "user",
                    "content": (
                        f"사용자 정보:\n"
                        + "\n".join(profile_lines)
                        + f"\n\n추천 경로: {path['name']}\n"
                        f"경로 설명: {path['subtitle']}\n"
                        f"총 {path['duration_weeks']}주 과정, 주 {path['weekly_hours']}시간\n\n"
                        "이 학습 경로가 왜 이 사용자에게 적합한지 2~3문장으로 설명해주세요."
                    ),
                },
            ],
            temperature=0.5,
            max_tokens=220,
        )

        explanation = response.choices[0].message.content.strip()
        _storage.path_explanations[cache_key] = explanation
        return explanation

    except Exception:
        return _fallback_why(path, req, reasons)


def _fallback_why(path: dict, req: MatchRequest, reasons: list[str]) -> str:
    """LLM 실패 시 규칙 기반 설명"""
    return (
        f"{req.level} 수준의 {req.age}세 학습자에게 맞춰진 경로입니다. "
        f"총 {path['duration_weeks']}주 동안 주당 {path['weekly_hours']}시간 정도 투자하시면, "
        f"{path['subtitle']} 목표를 달성하실 수 있습니다."
    )


# ============================================================
# 엔드포인트: 경로 상세 (콘텐츠 하이드레이션)
# ============================================================
@router.get("/{path_id}")
async def get_curriculum_detail(path_id: str):
    """학습 경로 상세 - 주차별 콘텐츠 정보 포함"""
    from data.mock_data import SAMPLE_CONTENTS

    path = get_path_by_id(path_id)
    if not path:
        raise HTTPException(404, f"학습 경로 {path_id}를 찾을 수 없습니다")

    # 모든 콘텐츠를 slno 기준으로 인덱싱
    all_contents_by_slno = {}
    # 실데이터 주제별 콘텐츠 그룹
    contents_by_topic = {}
    for topic_code, contents in SAMPLE_CONTENTS.items():
        contents_by_topic[topic_code] = list(contents)

    for topic_code, contents in SAMPLE_CONTENTS.items():
        for c in contents:
            all_contents_by_slno[c["contentsSlno"]] = c

    # 새 매칭 모듈 사용 - 학습경로별 명시적 주제 풀 + 중복 제거 + 품질 정렬
    from app.curriculum_matcher import match_contents_for_path
    hydrated_weeks = match_contents_for_path(
        path,
        contents_by_topic,
        all_contents_by_slno,
    )

    return {
        "id": path["id"],
        "name": path["name"],
        "subtitle": path["subtitle"],
        "target_level": path["target_level"],
        "target_goals": path["target_goals"],
        "duration_weeks": path["duration_weeks"],
        "weekly_hours": path["weekly_hours"],
        "total_contents": path["total_contents"],
        "milestones": path["milestones"],
        "weeks": hydrated_weeks,
    }


def _week_content_from_raw(content):
    """raw 콘텐츠 → 주차별 응답 형태"""
    return {
        "contents_slno": content["contentsSlno"],
        "title": content["title"],
        "summary": content.get("smrtnCntnt", ""),
        "make_type_code": content.get("makeTypeCode", ""),
        "url": content.get("xtrnlContentsUrl") or content.get("fileDownUrl"),
        "playtime_minutes": content.get("playCntnMi", ""),
    }


# ============================================================
# 엔드포인트: 학습 시작 & 진도 관리
# ============================================================
class StartPathRequest(BaseModel):
    user_id: str = Field(default="demo-user")


@router.post("/{path_id}/start")
async def start_path(path_id: str, req: StartPathRequest):
    """학습 경로 시작"""
    path = get_path_by_id(path_id)
    if not path:
        raise HTTPException(404, "해당 학습 경로를 찾을 수 없습니다")

    _storage.start_path(req.user_id, path_id)

    return {
        "ok": True,
        "path_id": path_id,
        "path_name": path["name"],
        "user_id": req.user_id,
        "message": f"{path['name']} 학습을 시작했습니다. 행운을 빕니다!",
    }


@router.post("/{path_id}/content/{slno}/complete")
async def toggle_content_completed(path_id: str, slno: str, req: StartPathRequest):
    """개별 콘텐츠 완료 토글 (체크 ↔ 해제)"""
    progress = _storage.get_progress(req.user_id)
    if not progress:
        raise HTTPException(400, "먼저 학습 경로를 시작해주세요 (/start)")

    if progress["path_id"] != path_id:
        raise HTTPException(400, "다른 학습 경로를 진행 중입니다")

    is_completed = _storage.toggle_completed(req.user_id, slno)

    # 진도율 계산
    path = get_path_by_id(path_id)
    total = path["total_contents"]
    completed_count = len(progress["completed_contents"])
    percent = round((completed_count / total) * 100, 1) if total else 0

    return {
        "ok": True,
        "content_slno": slno,
        "is_completed": is_completed,
        "progress_percent": percent,
        "completed": completed_count,
        "total": total,
    }


@router.get("/progress/me")
async def get_my_progress(user_id: str = "demo-user"):
    """내 진도 조회"""
    progress = _storage.get_progress(user_id)
    if not progress:
        return {"active_path": None, "completed_contents": [], "progress_percent": 0}

    path = get_path_by_id(progress["path_id"])
    total = path["total_contents"] if path else 0
    completed = list(progress["completed_contents"])
    percent = round((len(completed) / total) * 100, 1) if total else 0

    # 주차별 진도 계산
    weeks_progress = []
    if path:
        for week in path["weeks"]:
            week_slnos = set(week["content_slnos"])
            week_done = week_slnos & progress["completed_contents"]
            weeks_progress.append({
                "week_number": week["week_number"],
                "theme": week["theme"],
                "total_in_week": len(week_slnos),
                "completed_in_week": len(week_done),
                "week_percent": round((len(week_done) / len(week_slnos)) * 100, 1) if week_slnos else 0,
            })

    return {
        "active_path": {
            "id": progress["path_id"],
            "name": path["name"] if path else "",
            "started_at": progress["started_at"],
        },
        "completed_contents": completed,
        "progress_percent": percent,
        "total_contents": total,
        "weeks_progress": weeks_progress,
    }


@router.post("/reset")
async def reset_progress(req: StartPathRequest):
    """진도 초기화 (데모 편의 기능)"""
    if req.user_id in _storage.user_paths:
        del _storage.user_paths[req.user_id]
    return {"ok": True, "message": "진도가 초기화되었습니다"}
