"""
tests/conftest.py
─────────────────
pytest 부트스트랩 — 모든 test_*.py import 전에 실행됨.

[이 파일이 하는 일]
  1) 테스트용 dummy 환경변수 주입 (실 서비스 키 노출 차단)
  2) supabase-py 클라이언트가 dummy 키를 거부하는 것을 우회하기 위해
     app.core.supabase 모듈을 가벼운 MagicMock 으로 교체.
     → 단위 테스트는 외부 DB 없이도 main:app 을 import 할 수 있다.
  3) 외부 통신 (OpenAI / KIS) 도 호출 즉시 실패하지 않도록 sentinel 처리.

[의도]
  - 단위/스모크 테스트 환경에서 모듈 import 부작용을 격리.
  - 실제 통합 테스트가 필요한 경우 별도 마커(@pytest.mark.integration)로 분리 권장.
"""

import os
import sys
import types
from unittest.mock import MagicMock

# ── 1) 테스트용 환경변수 ─────────────────────────────────────────────────────
os.environ.setdefault("SUPABASE_URL",              "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY",         "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY",  "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET",        "test-jwt-secret-32-chars-padded!!")
os.environ.setdefault("OPENAI_API_KEY",             "sk-test")
os.environ.setdefault("KIS_APP_KEY",                "test-kis-key")
os.environ.setdefault("KIS_APP_SECRET",             "test-kis-secret")
os.environ.setdefault("KIS_ACCOUNT",                "00000000-00")
os.environ.setdefault("FASTAPI_SECRET_KEY",         "test-secret")

# ── 2) supabase 모듈을 MagicMock 으로 교체 ──────────────────────────────────
# app.core.supabase 가 import 되는 순간 create_client() 가 호출되어
# 실키가 아니면 SupabaseException 을 던진다. 테스트 환경에선 통째로 mock.
_fake_supabase = types.ModuleType("app.core.supabase")
_fake_supabase.supabase_client     = MagicMock(name="supabase_client")
_fake_supabase.supabase_admin      = MagicMock(name="supabase_admin")
_fake_supabase.get_supabase_client = MagicMock(return_value=_fake_supabase.supabase_client)
_fake_supabase.get_supabase_admin  = MagicMock(return_value=_fake_supabase.supabase_admin)
sys.modules["app.core.supabase"]   = _fake_supabase
