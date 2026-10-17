"""Profile, privacy, relationship-list, and block endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.services import social_service
from app.core.middleware import get_request_id
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
)
from app.modules.users import schemas

router = APIRouter(prefix="/users", tags=["users"])


def _profile_response(result: social_service.ProfileResult) -> schemas.ProfileResponse:
    user = result.user
    return schemas.ProfileResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        avatar_url=user.avatar_url,
        links=user.links,
        is_private=user.is_private,
        is_verified=user.is_verified,
        account_status=user.account_status.value,
        follower_count=result.follower_count,
        following_count=result.following_count,
        relationship=result.relationship,
        created_at=user.created_at,
    )


def _summary(user: User) -> schemas.UserSummary:
    return schemas.UserSummary.model_validate(user)


@router.patch("/me", response_model=schemas.ProfileResponse)
def update_me(
    body: schemas.UpdateProfileRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ProfileResponse:
    user = social_service.update_profile(
        db,
        current_user,
        display_name=body.display_name,
        bio=body.bio,
        avatar_url=body.avatar_url,
        links=body.links,
    )
    result = social_service.get_profile(
        db, viewer_id=user.id, username=user.username
    )
    return _profile_response(result)


@router.patch("/me/privacy", response_model=schemas.ProfileResponse)
def update_privacy(
    body: schemas.PrivacyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ProfileResponse:
    user = social_service.set_privacy(
        db,
        current_user,
        is_private=body.is_private,
        request_id=get_request_id(request),
    )
    result = social_service.get_profile(
        db, viewer_id=user.id, username=user.username
    )
    return _profile_response(result)


@router.get("/me/blocked", response_model=list[schemas.UserSummary])
def list_blocked(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[schemas.UserSummary]:
    return [_summary(u) for u in social_service.list_blocked(db, current_user)]


@router.get("/me/suggestions", response_model=list[schemas.SuggestionResponse])
def list_suggestions(
    limit: int = Query(default=10, ge=1, le=25),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[schemas.SuggestionResponse]:
    return [
        schemas.SuggestionResponse(
            user=_summary(item.user),
            follower_count=item.follower_count,
        )
        for item in social_service.list_suggested_users(
            db, user=current_user, limit=limit
        )
    ]


@router.post(
    "/{user_id}/block",
    response_model=schemas.RelationActionResponse,
    status_code=status.HTTP_200_OK,
)
def block_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.RelationActionResponse:
    result = social_service.block(
        db,
        blocker=current_user,
        target_id=user_id,
        request_id=get_request_id(request),
    )
    return schemas.RelationActionResponse(status=result)


@router.delete(
    "/{user_id}/block", response_model=schemas.RelationActionResponse
)
def unblock_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.RelationActionResponse:
    result = social_service.unblock(
        db,
        blocker=current_user,
        target_id=user_id,
        request_id=get_request_id(request),
    )
    return schemas.RelationActionResponse(status=result)


@router.get("/{username}", response_model=schemas.ProfileResponse)
def get_profile(
    username: str,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> schemas.ProfileResponse:
    result = social_service.get_profile(
        db,
        viewer_id=current_user.id if current_user else None,
        username=username,
    )
    return _profile_response(result)


def _page(
    page: social_service.RelationshipPage,
) -> PageResponse[schemas.UserSummary]:
    return PageResponse(
        items=[_summary(u) for u in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get(
    "/{username}/followers",
    response_model=PageResponse[schemas.UserSummary],
)
def list_followers(
    username: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.UserSummary]:
    return _page(
        social_service.list_followers(
            db,
            viewer_id=current_user.id if current_user else None,
            username=username,
            limit=limit,
            cursor=cursor,
        )
    )


@router.get(
    "/{username}/following",
    response_model=PageResponse[schemas.UserSummary],
)
def list_following(
    username: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.UserSummary]:
    return _page(
        social_service.list_following(
            db,
            viewer_id=current_user.id if current_user else None,
            username=username,
            limit=limit,
            cursor=cursor,
        )
    )
