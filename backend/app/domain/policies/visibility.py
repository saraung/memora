"""Resource-level visibility policies (ReBAC + ABAC).

Pure functions reused by profiles, follows, and later by feed, search,
posts, stories, and messaging. They take plain values — never ORM
objects — so they stay framework-free and unit-testable.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.domain.enums import AccountStatus


@dataclass(frozen=True)
class ProfileTarget:
    """Minimal target state needed for a visibility decision."""

    user_id: uuid.UUID
    account_status: AccountStatus
    is_private: bool


def can_view_profile(
    *,
    viewer_id: uuid.UUID | None,
    target: ProfileTarget,
    follows_target: bool,
    blocked_either_way: bool,
) -> bool:
    """Decide whether `viewer_id` may see `target`'s profile.

    - Non-active accounts are invisible to everyone (deleted vanishes).
    - A block in either direction hides both profiles.
    - Owners always see their own (active) profile.
    - Public profiles are visible even logged out.
    - Private profiles require an approved follow.
    """
    if target.account_status != AccountStatus.ACTIVE:
        return False
    if blocked_either_way:
        return False
    if viewer_id is not None and viewer_id == target.user_id:
        return True
    if not target.is_private:
        return True
    return follows_target


def can_initiate_relationship(
    *,
    viewer_id: uuid.UUID,
    target: ProfileTarget,
    blocked_either_way: bool,
) -> bool:
    """Decide whether `viewer_id` may follow/request/block `target`.

    Self-relationships, non-active targets, and blocks all deny.
    """
    if viewer_id == target.user_id:
        return False
    if target.account_status != AccountStatus.ACTIVE:
        return False
    if blocked_either_way:
        return False
    return True
