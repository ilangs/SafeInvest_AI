"""
scripts/archive_old_chats.py
─────────────────────────────
30일 이상 경과한 chat_history 레코드를 chat_history_archive 로 이관하고
원본 테이블에서 삭제하여 Supabase Free 500MB 한도를 보호한다.

[설계 결정]
  - 단순 DELETE 가 아니라 archive 테이블로 이관 — 추후 LLM 품질 분석/
    사용자 요청 시 복원 가능. 컬럼 동일 + archived_at 추가.
  - user_orders 는 절대 자동 삭제하지 않는다 (감사/세무/사용자 회고 학습용).
  - 청크 단위(기본 500행) 로 처리하여 한 트랜잭션이 너무 커지지 않도록 함.

[실행]
  cd backend
  python scripts/archive_old_chats.py                  # 30일 기본
  python scripts/archive_old_chats.py --days 60        # 60일 이전만
  python scripts/archive_old_chats.py --dry-run        # 대상 건수만 출력
  python scripts/archive_old_chats.py --chunk-size 200 # 청크 크기 조정

[권장 운영]
  GitHub Actions cron 으로 매주 일요일 03:00 KST 자동 실행.
  .github/workflows/archive_chats.yml 추가 예정.
"""

import argparse
import sys
import os
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="chat_history 아카이브 배치")
    p.add_argument("--days",       type=int, default=30,
                   help="이 일수 이전 데이터만 이관 (기본 30)")
    p.add_argument("--chunk-size", type=int, default=500,
                   help="한 번에 이관할 행 수 (기본 500)")
    p.add_argument("--dry-run",    action="store_true",
                   help="대상 건수만 출력하고 종료")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=args.days)
    cutoff_iso = cutoff.isoformat()

    print(f"[archive] cutoff = {cutoff_iso} ({args.days}일 이전)")

    # ── 1) 대상 건수 카운트 ─────────────────────────────────────────────────
    try:
        head_resp = (
            supabase_admin.table("chat_history")
            .select("id", count="exact")
            .lt("created_at", cutoff_iso)
            .limit(1)
            .execute()
        )
        total = head_resp.count or 0
    except Exception as exc:
        print(f"[archive] 대상 카운트 실패: {exc}")
        return 1

    print(f"[archive] 이관 대상 = {total} 건")

    if total == 0:
        print("[archive] 이관할 데이터 없음 — 종료")
        return 0

    if args.dry_run:
        print("[archive] --dry-run 모드 — 실제 이관 생략")
        return 0

    # ── 2) 청크 단위 이관 ──────────────────────────────────────────────────
    moved, deleted, errors = 0, 0, 0
    chunk = args.chunk_size

    while True:
        try:
            page = (
                supabase_admin.table("chat_history")
                .select("id,user_id,question,answer,session_id,"
                        "input_tokens,output_tokens,cost_usd,created_at")
                .lt("created_at", cutoff_iso)
                .order("created_at", desc=False)
                .limit(chunk)
                .execute()
            )
            rows = page.data or []
            if not rows:
                break

            # archive 테이블에 INSERT (id 그대로 유지 — UPSERT 로 멱등)
            supabase_admin.table("chat_history_archive").upsert(rows).execute()
            moved += len(rows)

            # 원본 삭제
            ids = [r["id"] for r in rows]
            supabase_admin.table("chat_history").delete().in_("id", ids).execute()
            deleted += len(ids)

            print(f"[archive] 진행: 이관 {moved}/{total}, 삭제 {deleted}/{total}")

        except Exception as exc:
            errors += 1
            print(f"[archive] 청크 처리 오류 ({errors}회차): {exc}")
            if errors >= 3:
                print("[archive] 오류 3회 누적 — 중단")
                return 2

    print(f"[archive] ✅ 완료: 이관 {moved} 건, 삭제 {deleted} 건, 오류 {errors} 회")
    return 0


if __name__ == "__main__":
    sys.exit(main())
