"""Reel endpoints: publish, feed, view counting, likes, delete."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.services import reel_service
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
)
from app.modules.stories import schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(tags=["reels"])


def _reel_response(detail: reel_service.ReelDetail) -> schemas.ReelResponse:
    return schemas.ReelResponse(
        id=detail.reel.id,
        caption=detail.reel.caption,
        author=UserSummary.model_validate(detail.author),
        video=schemas.StoryMediaResponse.model_validate(detail.video),
        cover=(
            schemas.StoryMediaResponse.model_validate(detail.cover)
            if detail.cover is not None
            else None
        ),
        view_count=detail.reel.view_count,
        like_count=detail.reel.like_count,
        comment_count=detail.reel.comment_count,
        liked=detail.liked,
        saved=detail.saved,
        created_at=detail.reel.created_at,
    )


@router.post(
    "/reels",
    response_model=schemas.ReelResponse,
    status_code=status.HTTP_201_CREATED,
)
def publish_reel(
    body: schemas.PublishReelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ReelResponse:
    reel = reel_service.publish_reel(
        db,
        author=current_user,
        video_id=body.video_id,
        cover_id=body.cover_id,
        caption=body.caption,
    )
    detail = reel_service.get_reel(
        db, viewer_id=current_user.id, reel_id=reel.id
    )
    return _reel_response(detail)


@router.get("/reels/feed", response_model=PageResponse[schemas.ReelResponse])
def reel_feed(
    limit: int = Query(default=10, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.ReelResponse]:
    page = reel_service.get_reel_feed(
        db,
        viewer_id=current_user.id if current_user else None,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[_reel_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get(
    "/users/{username}/reels",
    response_model=PageResponse[schemas.ReelResponse],
)
def user_reels(
    username: str,
    limit: int = Query(default=12, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.ReelResponse]:
    page = reel_service.list_user_reels(
        db,
        viewer_id=current_user.id if current_user else None,
        username=username,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[_reel_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get(
    "/reels/saved",
    response_model=PageResponse[schemas.ReelResponse],
)
def saved_reels(
    limit: int = Query(default=12, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.ReelResponse]:
    page = reel_service.list_saved_reels(
        db, user=current_user, limit=limit, cursor=cursor
    )
    return PageResponse(
        items=[_reel_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get("/reels/{reel_id}", response_model=schemas.ReelResponse)
def get_reel(
    reel_id: uuid.UUID,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> schemas.ReelResponse:
    detail = reel_service.get_reel(
        db,
        viewer_id=current_user.id if current_user else None,
        reel_id=reel_id,
    )
    return _reel_response(detail)


@router.post(
    "/reels/{reel_id}/views", response_model=schemas.ReelViewResponse
)
def reel_view(
    reel_id: uuid.UUID,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> schemas.ReelViewResponse:
    detail, counted = reel_service.record_view(
        db,
        viewer_id=current_user.id if current_user else None,
        reel_id=reel_id,
    )
    return schemas.ReelViewResponse(
        view_count=detail.reel.view_count,
        counted=counted,
        reel=_reel_response(detail),
    )


@router.put(
    "/reels/{reel_id}/like",
    response_model=schemas.ActionStatusResponse,
)
def like_reel(
    reel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = reel_service.like_reel(db, user=current_user, reel_id=reel_id)
    return schemas.ActionStatusResponse(status=result)


@router.delete(
    "/reels/{reel_id}/like",
    response_model=schemas.ActionStatusResponse,
)
def unlike_reel(
    reel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = reel_service.unlike_reel(db, user=current_user, reel_id=reel_id)
    return schemas.ActionStatusResponse(status=result)


@router.delete("/reels/{reel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reel(
    reel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> None:
    reel_service.delete_reel(db, author=current_user, reel_id=reel_id)


@router.put(
    "/reels/{reel_id}/save",
    response_model=schemas.ActionStatusResponse,
)
def save_reel(
    reel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = reel_service.bookmark_reel(
        db, user=current_user, reel_id=reel_id
    )
    return schemas.ActionStatusResponse(status=result)


@router.delete(
    "/reels/{reel_id}/save",
    response_model=schemas.ActionStatusResponse,
)
def unsave_reel(
    reel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = reel_service.unbookmark_reel(
        db, user=current_user, reel_id=reel_id
    )
    return schemas.ActionStatusResponse(status=result)


def _reel_comment_response(
    comment: reel_service.ReelComment, author: User
) -> schemas.ReelCommentResponse:
    return schemas.ReelCommentResponse(
        id=comment.id,
        body=comment.body,
        parent_id=comment.parent_id,
        author=UserSummary.model_validate(author),
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get(
    "/reels/{reel_id}/comments",
    response_model=PageResponse[schemas.ReelCommentResponse],
)
def list_reel_comments(
    reel_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.ReelCommentResponse]:
    page = reel_service.list_reel_comments(
        db,
        viewer_id=current_user.id if current_user else None,
        reel_id=reel_id,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[
            _reel_comment_response(item.comment, item.author)
            for item in page.items
        ],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.post(
    "/reels/{reel_id}/comments",
    response_model=schemas.ReelCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_reel_comment(
    reel_id: uuid.UUID,
    body: schemas.ReelCommentInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ReelCommentResponse:
    comment = reel_service.create_reel_comment(
        db,
        author=current_user,
        reel_id=reel_id,
        body=body.body,
        parent_id=body.parent_id,
    )
    return _reel_comment_response(comment, current_user)


@router.delete(
    "/reels/{reel_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_reel_comment(
    reel_id: uuid.UUID,
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> None:
    reel_service.delete_reel_comment(
        db, actor=current_user, reel_id=reel_id, comment_id=comment_id
    )
