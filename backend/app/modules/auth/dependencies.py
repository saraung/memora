"""FastAPI dependencies for the auth module."""

from __future__ import annotations

import uuid

from fastapi import Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.application.services import auth_service
from app.core.config import settings
from app.core.exceptions import UnauthorizedError
from app.core.middleware import get_request_id
from app.core.security import decode_access_token
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_session),
) -> User:
    """Resolve the authenticated user from a Bearer access token."""
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Authentication required")
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = uuid.UUID(str(payload["sub"]))
    except (ValueError, KeyError) as exc:
        raise UnauthorizedError("Invalid access token") from exc
    return auth_service.get_user_or_raise(db, user_id)


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_session),
) -> User | None:
    """Resolve the user when a Bearer token is present, else None.

    A present-but-invalid token still raises: public endpoints must not
    silently mask expired sessions.
    """
    if credentials is None or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = uuid.UUID(str(payload["sub"]))
    except (ValueError, KeyError) as exc:
        raise UnauthorizedError("Invalid access token") from exc
    return auth_service.get_user_or_raise(db, user_id)


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/api/v1/auth",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        domain=settings.COOKIE_DOMAIN,
    )


def client_info(request: Request) -> dict:
    return {
        "user_agent": request.headers.get("user-agent"),
        "ip": request.client.host if request.client else None,
        "request_id": get_request_id(request),
    }
