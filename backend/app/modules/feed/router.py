"""Home feed, discovery feed, and profile post grids."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.services import post_service
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
)
from app.modules.posts.router import _post_response
from app.modules.posts.schemas import PostResponse

router = APIRouter(tags=["feed"])


def _page(page: post_service.PostPage) -> PageResponse[PostResponse]:
    return PageResponse(
        items=[_post_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get("/feed", response_model=PageResponse[PostResponse])
def get_feed(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> PageResponse[PostResponse]:
    return _page(
        post_service.get_feed(
            db, viewer=current_user, limit=limit, cursor=cursor
        )
    )


@router.get("/explore", response_model=PageResponse[PostResponse])
def get_explore(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[PostResponse]:
    return _page(
        post_service.get_explore(
            db,
            viewer_id=current_user.id if current_user else None,
            limit=limit,
            cursor=cursor,
        )
    )


@router.get(
    "/users/{username}/posts",
    response_model=PageResponse[PostResponse],
)
def get_profile_posts(
    username: str,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[PostResponse]:
    return _page(
        post_service.get_profile_posts(
            db,
            viewer_id=current_user.id if current_user else None,
            username=username,
            limit=limit,
            cursor=cursor,
        )
    )
