"""
scripts/export_stock_terms.py
──────────────────────────────
Supabase stock_terms 테이블 전체를 단일 JSON 파일로 백업한다.

실행:
  cd backend
  python scripts/export_stock_terms.py

산출:
  backend/scripts/stock_terms.json   (덮어쓰기)
"""

import sys
import os
import json
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import supabase_admin

EXPORT_COLS = [
    'id','term','term_ko','category','importance',
    'initial_ko','initial_en','tags','related_ids',
    'description','easy_desc','formula','caution',
]

def main():
    res = (supabase_admin.table('stock_terms')
           .select(','.join(EXPORT_COLS))
           .order('id')
           .execute())
    rows = res.data or []
    print(f"📥 Supabase에서 {len(rows)}개 행 로드")

    out_path = Path(__file__).parent / 'stock_terms.json'
    out_path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(f"🎉 백업 완료 → {out_path}")
    print(f"   크기: {out_path.stat().st_size / 1024:.1f} KB")

if __name__ == '__main__':
    main()
