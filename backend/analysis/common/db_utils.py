# stock_data/common/db_utils.py

import os
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

# .env 파일에서 환경변수를 읽어옴
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
# SUPABASE_SERVICE_ROLE_KEY: RLS를 우회하여 쓰기 가능 (Render 환경변수 키 이름과 일치)
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_batch(table_name, records, conflict_columns, batch_size=500):
    """
    데이터를 DB에 넣되, 이미 같은 데이터가 있으면 업데이트하는 함수

    - table_name      : 테이블 이름 (예: 'stocks')
    - records         : 넣을 데이터 목록 (딕셔너리의 리스트)
    - conflict_columns: 중복 판단 기준 컬럼 (예: 'ticker')
    - batch_size      : 한 번에 처리할 건수 (기본 500건)
    """
    success = 0
    fail = 0

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            supabase.table(table_name).upsert(
                batch,
                on_conflict=conflict_columns
            ).execute()
            success += len(batch)
        except Exception as e:
            print(f"[에러] {table_name} batch {i}: {e}")
            fail += len(batch)

    return success, fail


def log_collection(collection_type, status, total, success, fail,
                   error_msg, started_at):
    """수집 결과를 data_collection_log 테이블에 기록."""
    try:
        supabase.table("data_collection_log").insert({
            "collection_type": collection_type,
            "status": status,
            "total_count": total,
            "success_count": success,
            "fail_count": fail,
            "error_message": error_msg,
            "started_at": started_at.isoformat(),
            "finished_at": datetime.now().isoformat()
        }).execute()
    except Exception as e:
        print(f"[WARN] log_collection 실패 (무시): {e}")