"""Fixed-window rate limiting with Redis backing and in-memory fallback.

Buckets are matched by request-path prefix. The store is module-global
so tests can swap it without touching the app wiring.
"""

from __future__ import annotations

import time

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# path prefix -> (max requests, window seconds). First match wins.
BUCKETS: list[tuple[str, tuple[int, int]]] = [
    ("/api/v1/auth/login", (settings.RATE_LIMIT_LOGIN_PER_MIN, 60)),
    ("/api/v1/auth/register", (settings.RATE_LIMIT_REGISTER_PER_MIN, 60)),
    ("/api/v1/auth/verify-email", (settings.RATE_LIMIT_SENSITIVE_PER_MIN, 60)),
    ("/api/v1/auth/password", (settings.RATE_LIMIT_SENSITIVE_PER_MIN, 60)),
    ("/api/v1/auth/refresh", (30, 60)),
    ("/api/v1/", (settings.RATE_LIMIT_DEFAULT_PER_MIN, 60)),
]

_WINDOW_PADDING = 1.0


class MemoryStore:
    """Single-process fallback. Not shared across workers."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}

    def allow(self, key: str, limit: int, window: int) -> tuple[bool, int]:
        now = time.monotonic()
        hits = [t for t in self._hits.get(key, []) if t > now - window]
        if len(hits) >= limit:
            retry = max(0, int((hits[0] + window) - now)) + 1
            self._hits[key] = hits
            return False, retry
        hits.append(now)
        self._hits[key] = hits
        return True, 0


class RedisStore:
    """Shared fixed-window counter via INCR + EXPIRE."""

    def __init__(self, url: str) -> None:
        import redis

        self._client = redis.Redis.from_url(url, socket_connect_timeout=2)

    def allow(self, key: str, limit: int, window: int) -> tuple[bool, int]:
        count = int(self._client.incr(key))
        if count == 1:
            self._client.expire(key, int(window + _WINDOW_PADDING))
        if count > limit:
            ttl = self._client.ttl(key)
            return False, max(0, int(ttl)) + 1 if ttl and ttl > 0 else window
        return True, 0


_store: MemoryStore | RedisStore | None = None
_warned_fallback = False


def get_store() -> MemoryStore | RedisStore:
    """Redis when reachable, otherwise a loud in-memory fallback."""
    global _store, _warned_fallback
    if _store is not None:
        return _store
    try:
        candidate = RedisStore(settings.REDIS_URL)
        candidate._client.ping()
        _store = candidate
        logger.info("Rate limiter: using Redis at %s", settings.REDIS_URL)
    except Exception as exc:  # noqa: BLE001 - degraded mode by design
        _store = MemoryStore()
        if not _warned_fallback:
            logger.warning(
                "Rate limiter: Redis unavailable (%s); using in-memory "
                "fallback (not shared across workers)",
                exc,
            )
            _warned_fallback = True
    return _store


def bucket_for(path: str) -> tuple[int, int] | None:
    for prefix, (limit, window) in BUCKETS:
        if path.startswith(prefix):
            return limit, window
    return None


def check(key: str, limit: int, window: int) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds)."""
    return get_store().allow(key, limit, window)
