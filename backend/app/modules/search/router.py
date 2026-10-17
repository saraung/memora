"""Search endpoints: users, posts, hashtags, and tag pages."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.services import search_service
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import get_optional_user
from app.modules.posts.router import _post_response
from app.modules.posts.schemas import PostResponse
from app.modules.search import schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(tags=["search"])


@router.get(
    "/search/users", response_model=PageResponse[UserSummary]
)
def search_users(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[UserSummary]:
    page = search_service.search_users(
        db,
        viewer_id=current_user.id if current_user else None,
        query=q,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[UserSummary.model_validate(u) for u in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get("/search/posts", response_model=PageResponse[PostResponse])
def search_posts(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[PostResponse]:
    page = search_service.search_posts(
        db,
        viewer_id=current_user.id if current_user else None,
        query=q,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[_post_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get(
    "/search/hashtags", response_model=PageResponse[schemas.HashtagResponse]
)
def search_hashtags(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.HashtagResponse]:
    _ = db  # hashtags carry no private payload; no auth needed
    page = search_service.search_hashtags(
        db, query=q, limit=limit, cursor=cursor
    )
    return PageResponse(
        items=[
            schemas.HashtagResponse(tag=h.tag, usage_count=h.usage_count)
            for h in page.items
        ],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get(
    "/hashtags/{tag}/posts", response_model=PageResponse[PostResponse]
)
def hashtag_posts(
    tag: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[PostResponse]:
    page = search_service.hashtag_posts(
        db,
        viewer_id=current_user.id if current_user else None,
        tag=tag,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[_post_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )
