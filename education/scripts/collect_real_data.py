"""
실제 금감원 API 데이터 수집 스크립트

수집 대상:
- 기존 13개 주제 + 신규 11개 = 총 24개 주제
- 각 주제 × 5개 교육대상 (청년/중장년/대학생/청소년/노년)

모드:
- incremental (기본, 권장): 기존 파일 로드 + 비어있거나 누락된 주제만 자동 검출해서 수집
  → 이전에 중간에 멈춘 주제도 자동으로 이어서 받음
- new-only: 신규 11개 주제만 수집 (기존 파일 무시, 테스트용)
- full: 전체 24개 주제 모두 다시 수집 (기존 파일 덮어씀)

특징:
- .env 파일에서 API 키 자동 로드
- Rate Limit 대응 (요청 간 2초 지연)
- 기존 파일 자동 백업 (real_contents.backup_YYYYMMDD_HHMMSS.json)
- 매 API 호출 후 즉시 저장 → 중단되어도 호출 단위까지 보존
- 실패 시 재시도 (최대 3회)
- 중복 제거 (contentsSlno 기준)

사용법:
    # 1. .env 파일 생성
    #    FSS_API_KEY=your-32-char-key

    # 2. 증분 모드 (기본, 권장) — 멈춰도 다시 실행만 하면 이어서 수집
    python scripts/collect_real_data.py

    # 3. 완료 후 데모 서버 자동으로 실데이터 사용
    python -m uvicorn app.main:app --reload
"""
import os
import sys
import json
import asyncio
import httpx
from pathlib import Path
from collections import defaultdict


# ============================================================
# .env 파일 자동 로드 (외부 라이브러리 없이 직접 구현)
# ============================================================
def load_dotenv(env_file: Path) -> dict:
    """
    .env 파일에서 환경변수를 읽어 os.environ에 주입
    python-dotenv 없이 순수 Python으로 구현
    """
    if not env_file.exists():
        return {}
    
    loaded = {}
    with open(env_file, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            # 빈 줄 및 주석 무시
            if not line or line.startswith("#"):
                continue
            # KEY=VALUE 파싱
            if "=" not in line:
                print(f"⚠️  .env:{line_num} 줄 무시 (KEY=VALUE 형식 아님): {line[:50]}")
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            # 따옴표 제거 (양쪽 같은 종류일 때만)
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            # os.environ에 이미 있으면 덮어쓰지 않음 (명시적 env 우선)
            if key not in os.environ:
                os.environ[key] = value
            loaded[key] = value
    return loaded


# 프로젝트 루트의 .env 자동 로드
_PROJECT_ROOT = Path(__file__).parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"
_loaded_env = load_dotenv(_ENV_FILE)

if _loaded_env:
    print(f"📄 .env 파일 로드: {len(_loaded_env)}개 변수")


# 출력 파일 경로
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "real_contents.json"

# 금감원 API 엔드포인트
API_URL = "https://www.fss.or.kr/edu/openApi/api/eduContents.jsp"

# ============================================================
# 수집 대상 주제 정의
# ============================================================
# 이미 수집 완료된 13개 주제 (v2.9 기준 586건)
EXISTING_TOPIC_CODES = [
    "2001", "2002", "2003",
    "3001", "3002", "3004",
    "4001", "4002",
    "5001", "5004", "5005",
    "6001", "6005",
]

# 아직 수집 안 된 11개 주제 (증분 모드에서 수집)
NEW_TOPIC_CODES = [
    "1001", "1002", "1003", "1004",  # 레벨1 (금융기초)
    "3003",                            # 투자기초 추가 주제
    "5002", "5003",                    # 신용 추가 주제
    "6002", "6003", "6004", "6006",   # 대출/부채/위험 추가 주제
]

# 전체 수집 대상 (풀 모드에서 사용)
TOPIC_CODES = EXISTING_TOPIC_CODES + NEW_TOPIC_CODES

TARGET_CODES = [
    ("Y", "청년"),
    ("A", "중장년"),
    ("U", "대학생"),
    ("H", "청소년"),
    ("R", "노년"),
]


async def fetch_one(
    client: httpx.AsyncClient,
    api_key: str,
    topic_code: str,
    target_code: str,
) -> tuple[list, str]:
    """
    특정 주제 + 대상 조합으로 API 호출.

    Returns:
        (contents, status):
            contents: 콘텐츠 리스트 (실패 시 빈 리스트)
            status: "ok" | "empty" | "rate_limit" | "error"
                - "ok": 정상 수집 (1건 이상)
                - "empty": 정상 응답이지만 결과가 0건 (차단 아님)
                - "rate_limit": HTML 에러 페이지 반환 (차단 의심)
                - "error": 그 외 에러 (네트워크 등)
    """
    params = {
        "apiType": "json",
        "authKey": api_key,
        "eduCntnt": topic_code,
        "eduTrgtCntnt": target_code,
    }

    last_error_kind = "error"

    for attempt in range(3):
        try:
            response = await client.get(API_URL, params=params, timeout=15.0)
            response.raise_for_status()

            # 인코딩 자동 감지
            content = response.content
            text = None
            for encoding in ["utf-8", "cp949", "euc-kr"]:
                try:
                    text = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue

            if not text:
                text = content.decode("utf-8", errors="replace")

            # HTML 에러 페이지 체크 → Rate Limit 의심
            if text.lstrip().lower().startswith(("<!doctype", "<html")):
                last_error_kind = "rate_limit"
                raise RuntimeError("서버가 HTML 에러 페이지 반환 (Rate Limit 가능)")

            data = json.loads(text)
            result = data.get("reponse", {}).get("result", [])
            if isinstance(result, dict):
                result = [result]

            if result:
                return result, "ok"
            else:
                return [], "empty"

        except Exception as e:
            if attempt < 2:
                print(f"    재시도 {attempt+1}/3 ({type(e).__name__})")
                await asyncio.sleep(3 ** attempt)
            else:
                print(f"    ❌ 실패: {e}")
                return [], last_error_kind

    return [], last_error_kind


def _load_existing_data() -> dict:
    """기존 real_contents.json 로드 (없으면 빈 dict)"""
    if not OUTPUT_FILE.exists():
        return {}
    try:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            print(f"⚠️  기존 파일이 예상 형식이 아닙니다 (dict 아님). 빈 상태로 시작합니다.")
            return {}
        return data
    except (json.JSONDecodeError, OSError) as e:
        print(f"⚠️  기존 파일 로드 실패 ({e}). 빈 상태로 시작합니다.")
        return {}


def _backup_existing() -> Path | None:
    """기존 파일이 있으면 타임스탬프 백업 생성"""
    if not OUTPUT_FILE.exists():
        return None
    from datetime import datetime
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = OUTPUT_FILE.with_name(f"{OUTPUT_FILE.stem}.backup_{ts}.json")
    try:
        import shutil
        shutil.copy2(OUTPUT_FILE, backup)
        return backup
    except OSError as e:
        print(f"⚠️  백업 생성 실패: {e}")
        return None


async def collect_all(mode: str = "incremental"):
    """
    금감원 데이터 수집.

    mode:
        - "incremental" (기본): 기존 파일 로드 + 비어있거나 누락된 주제만 자동 검출해 추가 수집.
          이전에 도중에 멈춘 주제도 자동으로 다시 시도함. 이미 수집된 주제는 스킵.
        - "new-only": 신규 11개 주제만 수집 (기존 파일 무시, 테스트용)
        - "full": 전체 24개 주제 모두 다시 수집 (기존 파일 덮어씀)
    """
    api_key = os.getenv("FSS_API_KEY")
    if not api_key:
        print("❌ FSS_API_KEY가 설정되지 않았습니다")
        print()
        print("💡 설정 방법 (.env 파일 사용 권장):")
        print("   1. 프로젝트 루트에 .env 파일 생성")
        print("   2. 다음 내용 입력:")
        print("      FSS_API_KEY=your-32-char-key")
        print()
        print("   또는 환경변수로 직접 설정:")
        print("   - Linux/Mac:  export FSS_API_KEY=\"your-key\"")
        print("   - PowerShell: $env:FSS_API_KEY = \"your-key\"")
        sys.exit(1)

    # 모드별 수집 주제 결정
    if mode == "full":
        target_topics = TOPIC_CODES
    elif mode == "new-only":
        target_topics = NEW_TOPIC_CODES
    else:  # incremental
        mode = "incremental"
        target_topics = NEW_TOPIC_CODES

    # 키 마스킹 (앞 4자, 뒤 4자만 표시)
    masked = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***"
    print(f"🔑 API 키: {masked} ({len(api_key)}자리)")

    print("=" * 70)
    print(f"🚀 금감원 e-금융교육센터 데이터 수집 시작 [모드: {mode}]")
    print("=" * 70)

    # 주제별로 콘텐츠 수집 (contents_slno 기준 중복 제거)
    contents_by_topic: defaultdict = defaultdict(dict)  # topic_code → {slno: content}

    # ========== 증분 모드: 기존 데이터 프리로드 + 누락 주제 자동 검출 ==========
    if mode == "incremental":
        existing = _load_existing_data()
        existing_count = 0
        for topic, items in existing.items():
            if not isinstance(items, list):
                continue
            for item in items:
                slno = item.get("contentsSlno")
                if slno:
                    contents_by_topic[topic][slno] = item
                    existing_count += 1

        if existing_count:
            print(f"📂 기존 데이터 로드: {len(existing)}개 주제, {existing_count}건")
            backup = _backup_existing()
            if backup:
                print(f"💾 백업 생성: {backup.name}")

            # 스마트 검출: 전체 24개 중 비어있거나 누락된 주제만 자동으로 수집 대상에 포함
            already_filled = {
                t for t, items in contents_by_topic.items()
                if len(items) > 0
            }
            target_topics = [t for t in TOPIC_CODES if t not in already_filled]

            # 진단 정보 출력
            missing_from_existing = [t for t in EXISTING_TOPIC_CODES if t not in already_filled]
            missing_from_new = [t for t in NEW_TOPIC_CODES if t not in already_filled]
            print()
            print("📊 수집 상태 진단:")
            print(f"   ✅ 수집 완료: {len(already_filled)}개 주제 ({sorted(already_filled)})")
            if missing_from_existing:
                print(f"   ⚠️  기존 주제 중 미수집: {missing_from_existing}")
            if missing_from_new:
                print(f"   ⚠️  신규 주제 중 미수집: {missing_from_new}")
            if not target_topics:
                print()
                print("🎉 모든 주제가 이미 수집되었습니다! 추가 수집할 항목이 없습니다.")
                print("   강제로 다시 수집하려면 --mode full을 사용하세요.")
                return
        else:
            print("📂 기존 데이터 없음 → 전체 주제를 수집합니다")
            target_topics = TOPIC_CODES

    # ========== full 모드: 기존 파일 백업 후 덮어쓰기 예정 ==========
    elif mode == "full":
        backup = _backup_existing()
        if backup:
            print(f"💾 기존 파일 백업 생성: {backup.name}")
        print("⚠️  full 모드: 기존 데이터를 덮어씁니다")

    print()
    print(f"   수집 대상: {len(target_topics)}개 주제 × {len(TARGET_CODES)}개 교육대상")
    print(f"   주제 목록: {sorted(target_topics)}")
    print(f"   총 API 호출: {len(target_topics) * len(TARGET_CODES)}회")
    print(f"   예상 소요 시간: {len(target_topics) * len(TARGET_CODES) * 3.5 / 60:.1f}분")
    print()

    total_fetched = 0
    failed_combos = []
    rate_limit_combos = []  # Rate Limit으로 실패한 조합 (재실행 시 다시 시도)

    # 백오프 설정: 연속 차단 감지 시 점진적으로 더 오래 대기
    REQUEST_DELAY = 3.0          # 호출 간 기본 지연 (초)
    BACKOFF_THRESHOLD = 3        # 연속 N회 차단되면 백오프 발동
    BACKOFF_SCHEDULE = [300, 900, 1800]  # 5분 → 15분 → 30분
    consecutive_rate_limits = 0
    backoff_step = 0

    async with httpx.AsyncClient() as client:
        combo_idx = 0
        total_combos = len(target_topics) * len(TARGET_CODES)
        aborted = False

        for topic_code in target_topics:
            if aborted:
                break
            for target_code, target_name in TARGET_CODES:
                combo_idx += 1
                print(f"[{combo_idx}/{total_combos}] 주제 {topic_code} × {target_name}({target_code}) ... ", end="", flush=True)

                contents, status = await fetch_one(client, api_key, topic_code, target_code)

                if status == "ok":
                    # 정상 수집 → 카운터 리셋
                    added = 0
                    for c in contents:
                        slno = c.get("contentsSlno")
                        if slno and slno not in contents_by_topic[topic_code]:
                            contents_by_topic[topic_code][slno] = c
                            added += 1
                    total_fetched += added
                    print(f"✅ {len(contents)}건 (신규 {added})")
                    if consecutive_rate_limits > 0:
                        print(f"    ↻ 회복! 연속 차단 카운터 리셋")
                    consecutive_rate_limits = 0
                    backoff_step = 0  # 회복했으니 다음 차단 시 다시 5분부터 시작

                elif status == "empty":
                    # 정상 응답이지만 0건 (차단 아님) → 카운터 리셋
                    print("⚠️  0건 (정상 응답)")
                    consecutive_rate_limits = 0

                elif status == "rate_limit":
                    consecutive_rate_limits += 1
                    rate_limit_combos.append(f"{topic_code}×{target_code}")
                    failed_combos.append(f"{topic_code}×{target_code}")
                    print(f"⚠️  차단 (연속 {consecutive_rate_limits}회)")

                else:  # "error"
                    failed_combos.append(f"{topic_code}×{target_code}")
                    print("⚠️  실패")

                # 매 호출 후 즉시 저장 (중단되어도 호출 단위까지 보존)
                _save_intermediate(contents_by_topic)

                # ===== 연속 차단 감지 시 백오프 =====
                if consecutive_rate_limits >= BACKOFF_THRESHOLD:
                    if backoff_step >= len(BACKOFF_SCHEDULE):
                        # 백오프 모두 소진 → 종료
                        print()
                        print("=" * 70)
                        print(f"⛔ 연속 차단이 계속됩니다. 수집을 중단합니다.")
                        print(f"   지금까지 수집한 데이터({total_fetched}건)는 모두 저장되었습니다.")
                        print(f"   잠시 후(1시간 이상 권장) 다시 실행하면 자동으로 이어서 받습니다:")
                        print(f"     python scripts/collect_real_data.py")
                        print("=" * 70)
                        aborted = True
                        break

                    wait_seconds = BACKOFF_SCHEDULE[backoff_step]
                    backoff_step += 1
                    minutes = wait_seconds // 60
                    print()
                    print("─" * 70)
                    print(f"⏸️  연속 {consecutive_rate_limits}회 차단 감지 → {minutes}분 대기 후 재개")
                    print(f"   ({backoff_step}/{len(BACKOFF_SCHEDULE)}단계 백오프)")
                    print(f"   현재까지 신규 수집: {total_fetched}건 (안전하게 저장됨)")
                    print("─" * 70)

                    # 카운트다운 (1분 단위)
                    remaining = wait_seconds
                    while remaining > 0:
                        m, s = divmod(remaining, 60)
                        print(f"   ⏱️  남은 대기: {m:02d}:{s:02d}", end="\r", flush=True)
                        sleep_chunk = min(60, remaining)
                        await asyncio.sleep(sleep_chunk)
                        remaining -= sleep_chunk
                    print(f"   ✅ 대기 완료. 수집을 재개합니다.{' ' * 30}")
                    print("─" * 70)

                    # 재개 시 카운터 리셋 (한 번 더 기회)
                    consecutive_rate_limits = 0
                    continue

                # 정상 호출 간 지연
                await asyncio.sleep(REQUEST_DELAY)

    # 최종 저장
    final_data = {
        topic: list(contents.values())
        for topic, contents in contents_by_topic.items()
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)

    print()
    print("=" * 70)
    if aborted:
        print(f"⏸️  수집 중단됨 (Rate Limit)")
    else:
        print(f"✅ 수집 완료!")
    print(f"   이번 실행 신규 수집: {total_fetched}건")
    grand_total = sum(len(v) for v in contents_by_topic.values())
    print(f"   전체 저장: {grand_total}건 ({len(contents_by_topic)}개 주제)")
    print(f"   주제별 분포:")
    for topic_code in sorted(contents_by_topic.keys()):
        count = len(contents_by_topic[topic_code])
        tag = " (신규)" if topic_code in NEW_TOPIC_CODES and mode == "incremental" else ""
        bar = "█" * min(count // 2, 40)
        print(f"     {topic_code}: {bar} {count}건{tag}")

    if rate_limit_combos:
        print()
        print(f"⚠️  Rate Limit으로 차단된 조합 ({len(rate_limit_combos)}개) → 다음 실행 시 자동 재시도:")
        for combo in rate_limit_combos[:10]:
            print(f"     - {combo}")
        if len(rate_limit_combos) > 10:
            print(f"     ... 외 {len(rate_limit_combos) - 10}개")

    other_failed = [c for c in failed_combos if c not in rate_limit_combos]
    if other_failed:
        print()
        print(f"⚠️  기타 실패한 조합 ({len(other_failed)}개):")
        for combo in other_failed[:10]:
            print(f"     - {combo}")
        if len(other_failed) > 10:
            print(f"     ... 외 {len(other_failed) - 10}개")

    print()
    print(f"📂 저장 위치: {OUTPUT_FILE}")
    print(f"📦 파일 크기: {OUTPUT_FILE.stat().st_size / 1024:.1f} KB")
    print()
    print("🎉 이제 데모 서버를 실행하면 자동으로 실데이터가 사용됩니다!")
    print("   python -m uvicorn app.main:app --reload")


def _save_intermediate(contents_by_topic):
    """중간 저장 (주제 단위)"""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {
        topic: list(contents.values())
        for topic, contents in contents_by_topic.items()
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="금감원 e-금융교육센터 실데이터 수집",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
수집 모드:
  incremental (기본)  기존 파일 로드 후 비어있거나 누락된 주제만 자동 검출해 수집
                      (이전에 중간에 멈춰도 다시 실행만 하면 이어서 받음)
  new-only            신규 11개 주제만 수집 (기존 파일 덮어씀, 테스트용)
  full                전체 24개 주제 다시 수집 (기존 파일 덮어씀)

예시:
  python scripts/collect_real_data.py                     # 증분 모드 (기본, 권장)
  python scripts/collect_real_data.py --mode full         # 전체 재수집
""",
    )
    parser.add_argument(
        "--mode",
        choices=["incremental", "new-only", "full"],
        default="incremental",
        help="수집 모드 선택 (기본: incremental)",
    )
    args = parser.parse_args()

    asyncio.run(collect_all(mode=args.mode))
