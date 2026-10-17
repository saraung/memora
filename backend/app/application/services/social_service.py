"""Social-graph use cases: profiles, follows, requests, blocks."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from sqlmodel import Session

from app.application.pagination import decode_cursor, encode_cursor
from app.application.services import notification_service
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.domain.enums import AccountStatus, FollowRequestStatus, NotificationType
from app.domain.policies.visibility import (
    ProfileTarget,
    can_initiate_relationship,
    can_view_profile,
)
from app.infrastructure.database.models.social import FollowRequest
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    audit_repository,
    social_repository,
    user_repository,
)

Relationship = Literal["self", "following", "requested", "none"]

MAX_LINKS = 4


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _validate_http_url(value: str, *, field: str) -> str:
    value = value.strip()
    if not (value.startswith("http://") or value.startswith("https://")):
        raise ValidationError(
            f"{field} must be an http(s) URL", details={"field": field}
        )
    return value


# -- Profiles -------------------------------------------------------------


@dataclass
class ProfileResult:
    user: User
    follower_count: int
    following_count: int
    relationship: Relationship


def _profile_target(user: User) -> ProfileTarget:
    return ProfileTarget(
        user_id=user.id,
        account_status=user.account_status,
        is_private=user.is_private,
    )


def get_profile(
    db: Session, *, viewer_id: uuid.UUID | None, username: str
) -> ProfileResult:
    """Return a visible profile or raise 404 (existence is not leaked)."""
    target = user_repository.get_by_username(db, username)
    if target is None:
        raise ResourceNotFoundError("User not found")
    blocked = (
        social_repository.is_blocked_either_way(db, viewer_id, target.id)
        if viewer_id is not None
        else False
    )
    follows_target = (
        social_repository.get_follow(db, viewer_id, target.id) is not None
        if viewer_id is not None
        else False
    )
    if not can_view_profile(
        viewer_id=viewer_id,
        target=_profile_target(target),
        follows_target=follows_target,
        blocked_either_way=blocked,
    ):
        raise ResourceNotFoundError("User not found")

    relationship: Relationship = "none"
    if viewer_id is not None:
        if viewer_id == target.id:
            relationship = "self"
        elif follows_target:
            relationship = "following"
        else:
            existing = social_repository.get_request(db, viewer_id, target.id)
            if (
                existing is not None
                and existing.status == FollowRequestStatus.PENDING
            ):
                relationship = "requested"

    return ProfileResult(
        user=target,
        follower_count=social_repository.count_followers(db, target.id),
        following_count=social_repository.count_following(db, target.id),
        relationship=relationship,
    )


def update_profile(
    db: Session,
    user: User,
    *,
    display_name: str | None = None,
    bio: str | None = None,
    avatar_url: str | None = None,
    links: list[str] | None = None,
) -> User:
    """Edit own profile. Staff fields can never change here."""
    if display_name is not None:
        display_name = display_name.strip()
        if not display_name:
            raise ValidationError(
                "Display name cannot be empty", details={"field": "display_name"}
            )
        user.display_name = display_name[:80]
    if bio is not None:
        user.bio = bio.strip()[:160] or None
    if avatar_url is not None:
        avatar_url = avatar_url.strip()
        user.avatar_url = (
            _validate_http_url(avatar_url, field="avatar_url")
            if avatar_url
            else None
        )
    if links is not None:
        if len(links) > MAX_LINKS:
            raise ValidationError(
                f"At most {MAX_LINKS} links allowed",
                details={"field": "links"},
            )
        user.links = [
            _validate_http_url(link, field="links") for link in links
        ] or None
    return user_repository.save(db, user)


def set_privacy(
    db: Session,
    user: User,
    *,
    is_private: bool,
    request_id: str | None = None,
) -> User:
    user.is_private = is_private
    user = user_repository.save(db, user)
    audit_repository.record(
        db,
        action="users.privacy_change",
        actor_id=user.id,
        target_type="user",
        target_id=str(user.id),
        request_id=request_id,
        meta={"is_private": is_private},
    )
    return user


# -- Follows ---------------------------------------------------------------


def _target_for_relationship(
    db: Session, *, actor_id: uuid.UUID, target_id: uuid.UUID
) -> User:
    if actor_id == target_id:
        raise ValidationError("You cannot follow yourself")
    target = user_repository.get_by_id(db, target_id)
    if target is None:
        raise ResourceNotFoundError("User not found")
    if not can_initiate_relationship(
        viewer_id=actor_id,
        target=_profile_target(target),
        blocked_either_way=social_repository.is_blocked_either_way(
            db, actor_id, target_id
        ),
    ):
        # Hide which condition failed (inactive vs. blocked).
        raise ResourceNotFoundError("User not found")
    return target


def follow(
    db: Session, *, follower: User, target_id: uuid.UUID
) -> Literal["followed", "requested"]:
    """Follow a public account or request a private one. Idempotent."""
    target = _target_for_relationship(
        db, actor_id=follower.id, target_id=target_id
    )
    if social_repository.get_follow(db, follower.id, target.id) is not None:
        return "followed"
    if not target.is_private:
        social_repository.create_follow(
            db, follower_id=follower.id, followed_id=target.id
        )
        social_repository.delete_requests_between(db, follower.id, target.id)
        notification_service.notify(
            db,
            recipient_id=target.id,
            actor_id=follower.id,
            type=NotificationType.FOLLOW,
            target_type="user",
            target_id=str(follower.id),
        )
        return "followed"
    existing = social_repository.get_request(db, follower.id, target.id)
    if existing is not None and existing.status == FollowRequestStatus.PENDING:
        return "requested"
    social_repository.upsert_pending_request(
        db, requester_id=follower.id, target_id=target.id
    )
    notification_service.notify(
        db,
        recipient_id=target.id,
        actor_id=follower.id,
        type=NotificationType.FOLLOW_REQUEST,
        target_type="user",
        target_id=str(follower.id),
    )
    return "requested"


def unfollow(
    db: Session, *, follower: User, target_id: uuid.UUID
) -> Literal["unfollowed"]:
    """Remove a follow and any pending request. Idempotent no-op."""
    social_repository.delete_follow(
        db, follower_id=follower.id, followed_id=target_id
    )
    record = social_repository.get_request(db, follower.id, target_id)
    if record is not None and record.status == FollowRequestStatus.PENDING:
        social_repository.cancel_request(db, record, now=_utcnow())
    return "unfollowed"


# -- Follow requests ----------------------------------------------------------


def list_incoming_requests(
    db: Session, user: User
) -> list[tuple[FollowRequest, User | None]]:
    records = social_repository.list_incoming_requests(db, user.id)
    result: list[tuple[FollowRequest, User | None]] = []
    for record in records:
        requester = user_repository.get_by_id(db, record.requester_id)
        if requester is None or not requester.is_active:
            continue
        result.append((record, requester))
    return result


def decide_request(
    db: Session,
    *,
    target: User,
    request_id: uuid.UUID,
    approve: bool,
    request_id_header: str | None = None,
) -> FollowRequest:
    record = social_repository.get_request_by_id(db, request_id)
    if record is None:
        raise ResourceNotFoundError("Follow request not found")
    if record.target_id != target.id:
        raise ForbiddenError("Only the account owner can decide requests")
    if record.status != FollowRequestStatus.PENDING:
        raise ConflictError("This request has already been decided")
    requester = user_repository.get_by_id(db, record.requester_id)
    if requester is None or not requester.is_active:
        raise ConflictError("The requester account is no longer active")
    if social_repository.is_blocked_either_way(db, requester.id, target.id):
        raise ForbiddenError("This request can no longer be approved")

    record = social_repository.decide_request(
        db, record, approve=approve, now=_utcnow()
    )
    if approve and (
        social_repository.get_follow(db, requester.id, target.id) is None
    ):
        social_repository.create_follow(
            db, follower_id=requester.id, followed_id=target.id
        )
        notification_service.notify(
            db,
            recipient_id=requester.id,
            actor_id=target.id,
            type=NotificationType.FOLLOW,
            target_type="user",
            target_id=str(target.id),
        )
    audit_repository.record(
        db,
        action="social.request_approved" if approve else "social.request_rejected",
        actor_id=target.id,
        target_type="follow_request",
        target_id=str(record.id),
        request_id=request_id_header,
        meta={"requester_id": str(requester.id)},
    )
    return record


def cancel_request(
    db: Session, *, requester: User, request_id: uuid.UUID
) -> FollowRequest:
    record = social_repository.get_request_by_id(db, request_id)
    if record is None:
        raise ResourceNotFoundError("Follow request not found")
    if record.requester_id != requester.id:
        raise ForbiddenError("Only the requester can cancel this request")
    if record.status != FollowRequestStatus.PENDING:
        raise ConflictError("This request has already been decided")
    return social_repository.cancel_request(db, record, now=_utcnow())


# -- Blocks --------------------------------------------------------------------


def block(
    db: Session,
    *,
    blocker: User,
    target_id: uuid.UUID,
    request_id: str | None = None,
) -> Literal["blocked"]:
    target = user_repository.get_by_id(db, target_id)
    if target is None:
        raise ResourceNotFoundError("User not found")
    if blocker.id == target.id:
        raise ValidationError("You cannot block yourself")
    if target.account_status == AccountStatus.DELETED:
        raise ResourceNotFoundError("User not found")
    if social_repository.get_block(db, blocker.id, target.id) is None:
        social_repository.create_block(
            db, blocker_id=blocker.id, blocked_id=target.id
        )
    # Strict both-directions teardown.
    social_repository.delete_follow(
        db, follower_id=blocker.id, followed_id=target.id
    )
    social_repository.delete_follow(
        db, follower_id=target.id, followed_id=blocker.id
    )
    social_repository.delete_requests_between(db, blocker.id, target.id)
    audit_repository.record(
        db,
        action="social.block",
        actor_id=blocker.id,
        target_type="user",
        target_id=str(target.id),
        request_id=request_id,
    )
    return "blocked"


def unblock(
    db: Session,
    *,
    blocker: User,
    target_id: uuid.UUID,
    request_id: str | None = None,
) -> Literal["unblocked"]:
    if blocker.id == target_id:
        raise ValidationError("You cannot unblock yourself")
    social_repository.delete_block(
        db, blocker_id=blocker.id, blocked_id=target_id
    )
    audit_repository.record(
        db,
        action="social.unblock",
        actor_id=blocker.id,
        target_type="user",
        target_id=str(target_id),
        request_id=request_id,
    )
    return "unblocked"


def list_blocked(db: Session, user: User) -> list[User]:
    return social_repository.list_blocked_users(db, user.id)


# -- Relationship lists ----------------------------------------------------------


@dataclass
class RelationshipPage:
    items: list[User]
    next_cursor: str | None
    has_more: bool


@dataclass
class SuggestedUser:
    user: User
    follower_count: int


def list_suggested_users(
    db: Session, *, user: User, limit: int = 10
) -> list[SuggestedUser]:
    """Most-followed active users outside the viewer's circle.

    Excludes self, followed accounts, and either-direction blocks.
    Powers the cold-start suggested-accounts strip.
    """
    limit = max(1, min(limit, 25))
    exclude = {user.id}
    exclude.update(social_repository.following_ids(db, user.id))
    exclude.update(social_repository.blocked_ids_for_user(db, user.id))
    return [
        SuggestedUser(user=u, follower_count=count)
        for u, count in social_repository.suggested_users(
            db, exclude_ids=exclude, limit=limit
        )
    ]


def _paginate_relationship(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    target: User,
    kind: Literal["followers", "following"],
    limit: int,
    cursor: str | None,
) -> RelationshipPage:
    blocked = (
        social_repository.is_blocked_either_way(db, viewer_id, target.id)
        if viewer_id is not None
        else False
    )
    follows_target = (
        social_repository.get_follow(db, viewer_id, target.id) is not None
        if viewer_id is not None
        else False
    )
    if not can_view_profile(
        viewer_id=viewer_id,
        target=_profile_target(target),
        follows_target=follows_target,
        blocked_either_way=blocked,
    ):
        raise ResourceNotFoundError("User not found")

    limit = max(1, min(limit, 50))
    before: tuple[datetime, uuid.UUID] | None = None
    if cursor:
        payload = decode_cursor(cursor)
        try:
            before = (
                datetime.fromisoformat(str(payload["c"])),
                uuid.UUID(str(payload["id"])),
            )
        except (ValueError, KeyError) as exc:
            raise ValidationError("Invalid pagination cursor") from exc

    if kind == "followers":
        rows = social_repository.list_followers(
            db, target.id, limit=limit, before=before
        )
    else:
        rows = social_repository.list_following(
            db, target.id, limit=limit, before=before
        )

    viewer_blocks: set[uuid.UUID] = set()
    if viewer_id is not None:
        viewer_blocks = social_repository.blocked_ids_for_user(db, viewer_id)

    items: list[User] = []
    last: tuple[datetime, uuid.UUID] | None = None
    for listed, followed_at in rows[:limit]:
        if listed.account_status != AccountStatus.ACTIVE:
            continue
        if listed.id in viewer_blocks:
            continue
        items.append(listed)
        last = (followed_at, listed.id)

    has_more = len(rows) > limit
    next_cursor = (
        encode_cursor({"c": last[0].isoformat(), "id": str(last[1])})
        if has_more and last is not None
        else None
    )
    return RelationshipPage(
        items=items, next_cursor=next_cursor, has_more=has_more
    )


def list_followers(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    username: str,
    limit: int = 20,
    cursor: str | None = None,
) -> RelationshipPage:
    target = user_repository.get_by_username(db, username)
    if target is None:
        raise ResourceNotFoundError("User not found")
    return _paginate_relationship(
        db,
        viewer_id=viewer_id,
        target=target,
        kind="followers",
        limit=limit,
        cursor=cursor,
    )


def list_following(
    db: Session,
    *,
    viewer_id: uuid.UUID | None,
    username: str,
    limit: int = 20,
    cursor: str | None = None,
) -> RelationshipPage:
    target = user_repository.get_by_username(db, username)
    if target is None:
        raise ResourceNotFoundError("User not found")
    return _paginate_relationship(
        db,
        viewer_id=viewer_id,
        target=target,
        kind="following",
        limit=limit,
        cursor=cursor,
    )
