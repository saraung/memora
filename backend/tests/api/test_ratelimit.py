"""Rate limiting + hardening middleware tests (isolated store)."""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.config import settings
from app.core.rate_limit import MemoryStore


@pytest.fixture()
def tiny_buckets(monkeypatch):
    """Strict buckets on an isolated in-memory store, limiter forced on."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(
        rate_limit,
        "BUCKETS",
        [("/api/v1/auth/login", (2, 60)), ("/api/v1/", (1000, 60))],
    )
    monkeypatch.setattr(rate_limit, "_store", MemoryStore())
    monkeypatch.setattr(rate_limit, "_warned_fallback", True)
    yield
    monkeypatch.setattr(rate_limit, "_store", None)


def test_login_rate_limited(client: TestClient, tiny_buckets) -> None:
    for _ in range(2):
        response = client.post(
            "/api/v1/auth/login",
            json={"identifier": "nobody@example.com", "password": "x"},
        )
        assert response.status_code == 401
    limited = client.post(
        "/api/v1/auth/login",
        json={"identifier": "nobody@example.com", "password": "x"},
    )
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "RATE_LIMITED"
    assert "Retry-After" in limited.headers
    assert limited.headers["X-Content-Type-Options"] == "nosniff"


def test_security_headers_present(client: TestClient, tiny_buckets) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "Referrer-Policy" in response.headers


def test_oversized_body_rejected(client: TestClient, tiny_buckets) -> None:
    response = client.post(
        "/api/v1/auth/login",
        content=b"x" * (settings.MAX_BODY_BYTES + 1),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_memory_store_window_resets() -> None:
    store = MemoryStore()
    assert store.allow("k", 1, 1) == (True, 0)
    allowed, retry = store.allow("k", 1, 1)
    assert allowed is False and retry >= 0
    time.sleep(1.1)
    assert store.allow("k", 1, 1)[0] is True
