"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlmodel import Session

from app.application.interfaces.email import EmailSender
from app.application.services import auth_service, token_service
from app.core.config import settings
from app.core.exceptions import TokenError
from app.infrastructure.database.repositories import rbac_repository
from app.infrastructure.database.session import get_session
from app.infrastructure.email.console import console_email_sender
from app.modules.auth import schemas
from app.modules.auth.dependencies import (
    clear_refresh_cookie,
    client_info,
    get_current_user,
    set_refresh_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_email_sender() -> EmailSender:
    return console_email_sender


def _user_response(user, db: Session) -> schemas.UserResponse:
    response = schemas.UserResponse.model_validate(user)
    response.roles = [r.name for r in rbac_repository.roles_of_user(db, user.id)]
    response.permissions = sorted(
        rbac_repository.permission_codes_for_user(db, user.id)
    )
    return response


def _auth_response(user, access_token: str, db: Session) -> schemas.AuthResponse:
    return schemas.AuthResponse(
        access_token=access_token,
        user=_user_response(user, db),
    )


@router.post(
    "/register",
    response_model=schemas.AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    body: schemas.RegisterRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_session),
    email_sender: EmailSender = Depends(get_email_sender),
) -> schemas.AuthResponse:
    info = client_info(request)
    result = auth_service.register(
        db,
        email=str(body.email),
        username=body.username,
        password=body.password,
        display_name=body.display_name,
        email_sender=email_sender,
        user_agent=info["user_agent"],
        ip=info["ip"],
        request_id=info["request_id"],
    )
    set_refresh_cookie(response, result.refresh_token)
    return _auth_response(result.user, result.access_token, db)


@router.post("/login", response_model=schemas.AuthResponse)
def login(
    body: schemas.LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_session),
) -> schemas.AuthResponse:
    info = client_info(request)
    result = auth_service.login(
        db,
        identifier=body.identifier,
        password=body.password,
        user_agent=info["user_agent"],
        ip=info["ip"],
    )
    set_refresh_cookie(response, result.refresh_token)
    return _auth_response(result.user, result.access_token, db)


@router.post("/refresh", response_model=schemas.AuthResponse)
def refresh(
    response: Response,
    request: Request,
    db: Session = Depends(get_session),
) -> schemas.AuthResponse:
    raw_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not raw_token:
        raise TokenError("Refresh token cookie is missing")
    info = client_info(request)
    user, access_token, new_refresh = token_service.rotate_session(
        db,
        raw_token,
        user_agent=info["user_agent"],
        ip=info["ip"],
    )
    set_refresh_cookie(response, new_refresh)
    return _auth_response(user, access_token, db)


@router.post("/logout", response_model=schemas.MessageResponse)
def logout(
    response: Response,
    request: Request,
    db: Session = Depends(get_session),
) -> schemas.MessageResponse:
    raw_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if raw_token:
        token_service.revoke_session(db, raw_token)
    clear_refresh_cookie(response)
    return schemas.MessageResponse(message="Logged out")


@router.post("/logout-all", response_model=schemas.MessageResponse)
def logout_all(
    response: Response,
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.MessageResponse:
    token_service.revoke_all_sessions(db, current_user)
    clear_refresh_cookie(response)
    return schemas.MessageResponse(message="Logged out from all sessions")


@router.get("/me", response_model=schemas.UserResponse)
def me(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.UserResponse:
    return _user_response(current_user, db)


@router.post("/verify-email", response_model=schemas.MessageResponse)
def verify_email(
    body: schemas.VerifyEmailRequest,
    db: Session = Depends(get_session),
) -> schemas.MessageResponse:
    auth_service.verify_email(db, body.token)
    return schemas.MessageResponse(message="Email verified")


@router.post("/password/forgot", response_model=schemas.MessageResponse)
def password_forgot(
    body: schemas.PasswordForgotRequest,
    db: Session = Depends(get_session),
    email_sender: EmailSender = Depends(get_email_sender),
) -> schemas.MessageResponse:
    # Always return success: do not reveal whether the email exists.
    auth_service.request_password_reset(
        db, email=str(body.email), email_sender=email_sender
    )
    return schemas.MessageResponse(
        message="If the email exists, a reset link was sent"
    )


@router.post("/password/reset", response_model=schemas.MessageResponse)
def password_reset(
    body: schemas.PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_session),
) -> schemas.MessageResponse:
    auth_service.reset_password(
        db,
        raw_token=body.token,
        new_password=body.new_password,
        request_id=client_info(request)["request_id"],
    )
    return schemas.MessageResponse(message="Password has been reset")
