"""Story endpoints: publish, feed, view, viewers, delete."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.services import story_service
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
)
from app.modules.stories import schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(tags=["stories"])


def _story_response(detail: story_service.StoryDetail) -> schemas.StoryResponse:
    return schemas.StoryResponse(
        id=detail.story.id,
        caption=detail.story.caption,
        author=UserSummary.model_validate(detail.author),
        media=schemas.StoryMediaResponse.model_validate(detail.media),
        viewed=detail.viewed,
        created_at=detail.story.created_at,
        expires_at=detail.story.expires_at,
    )


@router.post(
    "/stories",
    response_model=schemas.StoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def publish_story(
    body: schemas.PublishStoryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.StoryResponse:
    story = story_service.publish_story(
        db, author=current_user, media_id=body.media_id, caption=body.caption
    )
    detail = story_service.get_story(
        db, viewer_id=current_user.id, story_id=story.id
    )
    return _story_response(detail)


@router.get(
    "/stories/feed",
    response_model=PageResponse[schemas.AuthorStoriesResponse],
)
def story_feed(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.AuthorStoriesResponse]:
    page = story_service.list_story_feed(
        db, viewer=current_user, limit=limit, cursor=cursor
    )
    return PageResponse(
        items=[
            schemas.AuthorStoriesResponse(
                author=UserSummary.model_validate(group.author),
                stories=[_story_response(s) for s in group.stories],
                has_unseen=group.has_unseen,
            )
            for group in page.items
        ],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get("/stories/{story_id}", response_model=schemas.StoryResponse)
def get_story(
    story_id: uuid.UUID,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> schemas.StoryResponse:
    detail = story_service.get_story(
        db,
        viewer_id=current_user.id if current_user else None,
        story_id=story_id,
    )
    return _story_response(detail)


@router.post(
    "/stories/{story_id}/views", response_model=schemas.StoryResponse
)
def view_story(
    story_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.StoryResponse:
    detail = story_service.view_story(
        db, viewer=current_user, story_id=story_id
    )
    return _story_response(detail)


@router.get(
    "/stories/{story_id}/viewers",
    response_model=list[schemas.ViewerSummary],
)
def story_viewers(
    story_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[schemas.ViewerSummary]:
    users = story_service.list_viewers(
        db, owner=current_user, story_id=story_id
    )
    return [schemas.ViewerSummary.model_validate(u) for u in users]


@router.delete("/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(
    story_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> None:
    story_service.delete_story(db, author=current_user, story_id=story_id)


@router.get(
    "/users/{username}/stories",
    response_model=PageResponse[schemas.StoryResponse],
)
def user_stories(
    username: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.StoryResponse]:
    page = story_service.list_user_stories(
        db,
        viewer_id=current_user.id if current_user else None,
        username=username,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[_story_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )
