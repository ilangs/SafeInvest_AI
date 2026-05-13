"""
scripts/upsert_new_terms.py
────────────────────────────
new_terms_dryrun.json 의 신규 용어를 Supabase stock_terms 테이블에 upsert.

실행:
  cd backend
  python scripts/upsert_new_terms.py            # dry-run (DB 미반영)
  python scripts/upsert_new_terms.py --apply    # 실제 반영
"""

import sys
import os
import json
import argparse
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin

# stock_terms 테이블 컬럼 (디버깅 필드 제외)
ALLOWED_COLS = {
    'id','term','term_ko','category','importance',
    'initial_ko','initial_en','tags','related_ids',
    'description','easy_desc','formula','caution',
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='실제 DB 반영')
    args = parser.parse_args()

    json_path = Path(__file__).parent / 'new_terms_dryrun.json'
    data = json.loads(json_path.read_text(encoding='utf-8'))
    print(f"📂 입력 파일: {json_path}  (항목 {len(data)}개)")

    # 디버깅 필드 제거 + 누락 컬럼 보강
    clean = []
    for e in data:
        row = {k: v for k, v in e.items() if k in ALLOWED_COLS}
        row.setdefault('related_ids', [])
        row.setdefault('tags', [])
        row.setdefault('importance', 3)
        # term_ko 빈문자열/문자열 "null" → None
        tk = row.get('term_ko')
        if isinstance(tk, str) and tk.strip().lower() in ('', 'null', 'none'):
            row['term_ko'] = None
        clean.append(row)

    # 사전 검증: id/term 충돌
    seen_id = {}
    seen_term = {}
    for r in clean:
        seen_id.setdefault(r['id'], []).append(r['term'])
        seen_term.setdefault(r['term'].lower(), []).append(r['id'])
    dup_id = {k: v for k, v in seen_id.items() if len(v) > 1}
    dup_term = {k: v for k, v in seen_term.items() if len(v) > 1}
    if dup_id or dup_term:
        print(f"⚠️  내부 충돌: id={dup_id}, term={dup_term}")
        return

    # DB 측 기존 ID 충돌 점검
    res = supabase_admin.table('stock_terms').select('id,term').execute()
    db_ids = {r['id'] for r in (res.data or [])}
    db_terms = {r['term'].lower() for r in (res.data or [])}
    collide_id = [r['id'] for r in clean if r['id'] in db_ids]
    collide_term = [r['term'] for r in clean if r['term'].lower() in db_terms]
    print(f"📋 DB 사전 점검: 기존 {len(db_ids)}개")
    print(f"   - id 충돌: {len(collide_id)}건  {collide_id[:5]}")
    print(f"   - term 충돌: {len(collide_term)}건  {collide_term[:5]}")

    if not args.apply:
        print(f"\n[DRY-RUN] --apply 플래그가 없어 실제 반영하지 않습니다.")
        print(f"   샘플 첫 행:")
        print(json.dumps(clean[0], ensure_ascii=False, indent=2))
        return

    # 실제 반영 (배치 upsert)
    print(f"\n🚀 upsert 시작 (배치 50개)...")
    CHUNK = 50
    ok = 0
    for i in range(0, len(clean), CHUNK):
        slice_ = clean[i:i+CHUNK]
        try:
            supabase_admin.table('stock_terms').upsert(slice_, on_conflict='id').execute()
            ok += len(slice_)
            print(f"  ✅ {ok}/{len(clean)}")
        except Exception as e:
            print(f"  ❌ 배치 {i}-{i+len(slice_)} 실패: {e}")
            raise

    # 검증
    res2 = supabase_admin.table('stock_terms').select('id', count='exact').execute()
    total = res2.count if hasattr(res2, 'count') else len(res2.data or [])
    print(f"\n🎉 완료. 현재 stock_terms 행 수: {total}")

if __name__ == '__main__':
    main()
