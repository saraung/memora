"""Posts, comments, likes, and bookmarks."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.services import post_service
from app.application.services.post_service import PostDetail
from app.infrastructure.database.models.content import Comment
from app.infrastructure.database.models.user import User
from app.infrastructure.database.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    get_optional_user,
)
from app.modules.posts import schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(tags=["posts"])


def _author_summary(user: User) -> UserSummary:
    return UserSummary.model_validate(user)


def _post_response(detail: PostDetail) -> schemas.PostResponse:
    return schemas.PostResponse(
        id=detail.post.id,
        caption=detail.post.caption,
        author=_author_summary(detail.author),
        media=[
            schemas.PostMediaResponse(
                id=asset.id,
                resource_type=asset.resource_type,
                format=asset.format,
                width=asset.width,
                height=asset.height,
                duration=asset.duration,
                secure_url=asset.secure_url,
                alt_text=alt_text,
            )
            for asset, alt_text in detail.media
        ],
        like_count=detail.post.like_count,
        comment_count=detail.post.comment_count,
        liked=detail.liked,
        bookmarked=detail.bookmarked,
        source=detail.source,
        created_at=detail.post.created_at,
        updated_at=detail.post.updated_at,
    )


def _comment_response(
    comment: Comment, author: User
) -> schemas.CommentResponse:
    return schemas.CommentResponse(
        id=comment.id,
        body=comment.body,
        parent_id=comment.parent_id,
        author=_author_summary(author),
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.post(
    "/posts",
    response_model=schemas.PostResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_post(
    body: schemas.CreatePostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.PostResponse:
    post = post_service.create_post(
        db,
        author=current_user,
        caption=body.caption,
        items=[item.model_dump() for item in body.items],
    )
    detail = post_service.get_post_detail(
        db, post, viewer_id=current_user.id
    )
    return _post_response(detail)


@router.get("/posts/{post_id}", response_model=schemas.PostResponse)
def get_post(
    post_id: uuid.UUID,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> schemas.PostResponse:
    post = post_service.visible_post_or_404(
        db,
        viewer_id=current_user.id if current_user else None,
        post_id=post_id,
    )
    detail = post_service.get_post_detail(
        db, post, viewer_id=current_user.id if current_user else None
    )
    return _post_response(detail)


@router.patch("/posts/{post_id}", response_model=schemas.PostResponse)
def edit_post(
    post_id: uuid.UUID,
    body: schemas.EditPostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.PostResponse:
    post = post_service.edit_post(
        db, author=current_user, post_id=post_id, caption=body.caption
    )
    detail = post_service.get_post_detail(db, post, viewer_id=current_user.id)
    return _post_response(detail)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> None:
    post_service.delete_post(db, author=current_user, post_id=post_id)


@router.put(
    "/posts/{post_id}/like",
    response_model=schemas.ActionStatusResponse,
)
def like_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = post_service.like_post(db, user=current_user, post_id=post_id)
    return schemas.ActionStatusResponse(status=result)


@router.delete(
    "/posts/{post_id}/like",
    response_model=schemas.ActionStatusResponse,
)
def unlike_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = post_service.unlike_post(db, user=current_user, post_id=post_id)
    return schemas.ActionStatusResponse(status=result)


@router.put(
    "/posts/{post_id}/bookmark",
    response_model=schemas.ActionStatusResponse,
)
def bookmark_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = post_service.bookmark_post(
        db, user=current_user, post_id=post_id
    )
    return schemas.ActionStatusResponse(status=result)


@router.delete(
    "/posts/{post_id}/bookmark",
    response_model=schemas.ActionStatusResponse,
)
def unbookmark_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.ActionStatusResponse:
    result = post_service.unbookmark_post(
        db, user=current_user, post_id=post_id
    )
    return schemas.ActionStatusResponse(status=result)


@router.get("/users/me/bookmarks", response_model=PageResponse[schemas.PostResponse])
def list_my_bookmarks(
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.PostResponse]:
    page = post_service.list_bookmarks(
        db, user=current_user, limit=limit, cursor=cursor
    )
    return PageResponse(
        items=[_post_response(item) for item in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get(
    "/posts/{post_id}/comments",
    response_model=PageResponse[schemas.CommentResponse],
)
def list_comments(
    post_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.CommentResponse]:
    page = post_service.list_comments(
        db,
        viewer_id=current_user.id if current_user else None,
        post_id=post_id,
        limit=limit,
        cursor=cursor,
    )
    return PageResponse(
        items=[
            _comment_response(item.comment, item.author)
            for item in page.items
        ],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.post(
    "/posts/{post_id}/comments",
    response_model=schemas.CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    post_id: uuid.UUID,
    body: schemas.CommentInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.CommentResponse:
    from app.infrastructure.database.repositories import user_repository

    comment = post_service.create_comment(
        db,
        author=current_user,
        post_id=post_id,
        body=body.body,
        parent_id=body.parent_id,
    )
    author = user_repository.get_by_id(db, comment.author_id)
    assert author is not None
    return _comment_response(comment, author)


@router.patch(
    "/comments/{comment_id}", response_model=schemas.CommentResponse
)
def edit_comment(
    comment_id: uuid.UUID,
    body: schemas.EditCommentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> schemas.CommentResponse:
    from app.infrastructure.database.repositories import user_repository

    comment = post_service.edit_comment(
        db, author=current_user, comment_id=comment_id, body=body.body
    )
    author = user_repository.get_by_id(db, comment.author_id)
    assert author is not None
    return _comment_response(comment, author)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> None:
    post_service.delete_comment(
        db, actor=current_user, comment_id=comment_id
    )
