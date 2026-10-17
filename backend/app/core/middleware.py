"""Cross-cutting HTTP middleware: request IDs, rate limits, hardening."""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core import rate_limit
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a correlation ID to every request/response."""

    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or getattr(
            request.state, "request_id", None
        )
        if not request_id:
            request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "%s %s -> %s (%.1fms) rid=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )
        return response


def get_request_id(request: Request) -> str:
    """Return the request correlation ID, generating one if missing."""
    request_id = getattr(request.state, "request_id", None)
    if not request_id:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
    return request_id


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window rate limiting per client IP + endpoint bucket."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        bucket = rate_limit.bucket_for(request.url.path)
        if bucket is None:
            return await call_next(request)
        limit, window = bucket
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client is not None:
            client_ip = request.client.host
        else:
            client_ip = "unknown"
        allowed, retry_after = rate_limit.check(
            f"rl:{request.url.path}:{client_ip}", limit, window
        )
        if not allowed:
            request_id = get_request_id(request)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Too many requests. Please slow down.",
                        "details": {"retry_after_seconds": retry_after},
                        "request_id": request_id,
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Baseline hardening headers on every response."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method == "POST":
            try:
                content_length = int(request.headers.get("content-length", "0"))
            except ValueError:
                content_length = 0
            if content_length > settings.MAX_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "PAYLOAD_TOO_LARGE",
                            "message": "Request body exceeds the size limit.",
                            "details": {},
                            "request_id": get_request_id(request),
                        }
                    },
                )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response
