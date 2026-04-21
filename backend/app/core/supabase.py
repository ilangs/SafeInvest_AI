"""
app/core/supabase.py
────────────────────
Supabase 클라이언트 싱글턴.

- supabase_client  : anon key 클라이언트 (일반 조회용)
- supabase_admin   : service_role 클라이언트 (RLS 우회, 서버-사이드 전용)

⚠️  service_role 키는 절대 Frontend 에 노출하지 마세요.
"""

from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings


@lru_cache
def get_supabase_client() -> Client:
    """anon 권한 클라이언트 — RLS 정책을 그대로 따릅니다."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_supabase_admin() -> Client:
    """service_role 클라이언트 — RLS 를 우회합니다. 서버 내부 로직 전용."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# 편의 별칭 (모듈 임포트 시 직접 사용)
supabase_client: Client = get_supabase_client()
supabase_admin: Client  = get_supabase_admin()
