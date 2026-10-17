"""Follow, unfollow, and follow-request endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlmodel import Session

from app.application.services import social_service
from app.core.middleware import get_request_id
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.infrastructure.database.repositories import user_repository
from app.modules.auth.dependencies import get_current_user
from app.modules.users import schemas

router = APIRouter(tags=["follows"])


@router.post(
    "/users/{user_id}/follow",
    response_model=schemas.RelationActionResponse,
    status_code=status.HTTP_200_OK,
)
def follow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.RelationActionResponse:
    result = social_service.follow(
        db, follower=current_user, target_id=user_id
    )
    return schemas.RelationActionResponse(status=result)


@router.delete(
    "/users/{user_id}/follow",
    response_model=schemas.RelationActionResponse,
)
def unfollow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.RelationActionResponse:
    result = social_service.unfollow(
        db, follower=current_user, target_id=user_id
    )
    return schemas.RelationActionResponse(status=result)


@router.get(
    "/follow-requests",
    response_model=list[schemas.FollowRequestResponse],
)
def list_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[schemas.FollowRequestResponse]:
    pairs = social_service.list_incoming_requests(db, current_user)
    return [
        schemas.FollowRequestResponse(
            id=record.id,
            status=record.status.value,
            created_at=record.created_at,
            requester=schemas.UserSummary.model_validate(requester),
        )
        for record, requester in pairs
    ]


@router.post(
    "/follow-requests/{request_id}/approve",
    response_model=schemas.FollowRequestResponse,
)
def approve_request(
    request_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.FollowRequestResponse:
    record = social_service.decide_request(
        db,
        target=current_user,
        request_id=request_id,
        approve=True,
        request_id_header=get_request_id(request),
    )
    requester = user_repository.get_by_id(db, record.requester_id)
    assert requester is not None
    return schemas.FollowRequestResponse(
        id=record.id,
        status=record.status.value,
        created_at=record.created_at,
        requester=schemas.UserSummary.model_validate(requester),
    )


@router.post(
    "/follow-requests/{request_id}/reject",
    response_model=schemas.FollowRequestResponse,
)
def reject_request(
    request_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.FollowRequestResponse:
    record = social_service.decide_request(
        db,
        target=current_user,
        request_id=request_id,
        approve=False,
        request_id_header=get_request_id(request),
    )
    requester = user_repository.get_by_id(db, record.requester_id)
    assert requester is not None
    return schemas.FollowRequestResponse(
        id=record.id,
        status=record.status.value,
        created_at=record.created_at,
        requester=schemas.UserSummary.model_validate(requester),
    )


@router.delete(
    "/follow-requests/{request_id}",
    response_model=schemas.FollowRequestResponse,
)
def cancel_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.FollowRequestResponse:
    record = social_service.cancel_request(
        db, requester=current_user, request_id=request_id
    )
    return schemas.FollowRequestResponse(
        id=record.id,
        status=record.status.value,
        created_at=record.created_at,
        requester=schemas.UserSummary.model_validate(current_user),
    )
