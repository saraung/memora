"""Memora FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.errors import register_exception_handlers
from app.api.v1.router import v1_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import (
    RateLimitMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from app.modules.messaging.ws import router as ws_router

setup_logging()

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(v1_router)
# Realtime gateway mounted explicitly (singleton route).
app.include_router(ws_router)


@app.get("/")
def root() -> dict:
    return {"status": "alive", "app": settings.APP_NAME}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
