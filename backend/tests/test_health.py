import os
os.environ.setdefault("SUPABASE_URL",              "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY",         "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY",  "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET",        "test-jwt-secret-32-chars-padded!!")
os.environ.setdefault("OPENAI_API_KEY",             "sk-test")
os.environ.setdefault("KIS_APP_KEY",                "test-kis-key")
os.environ.setdefault("KIS_APP_SECRET",             "test-kis-secret")
os.environ.setdefault("KIS_ACCOUNT",                "00000000-00")
os.environ.setdefault("FASTAPI_SECRET_KEY",         "test-secret")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

def test_no_token_returns_401():
    resp = client.get("/api/v1/auth/verify")
    assert resp.status_code in (401, 403)

def test_invalid_token_returns_401():
    resp = client.get(
        "/api/v1/auth/verify",
        headers={"Authorization": "Bearer bad.token.here"}
    )
    assert resp.status_code == 401