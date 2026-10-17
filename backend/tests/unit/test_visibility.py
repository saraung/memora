"""Unit tests for the visibility policy layer (pure functions)."""

from __future__ import annotations

import uuid

from app.domain.enums import AccountStatus
from app.domain.policies.visibility import (
    ProfileTarget,
    can_initiate_relationship,
    can_view_profile,
)


def _target(
    *, status: AccountStatus = AccountStatus.ACTIVE, private: bool = False
) -> ProfileTarget:
    return ProfileTarget(
        user_id=uuid.uuid4(), account_status=status, is_private=private
    )


def test_public_profile_visible_to_everyone() -> None:
    target = _target()
    assert (
        can_view_profile(
            viewer_id=None,
            target=target,
            follows_target=False,
            blocked_either_way=False,
        )
        is True
    )
    assert (
        can_view_profile(
            viewer_id=uuid.uuid4(),
            target=target,
            follows_target=False,
            blocked_either_way=False,
        )
        is True
    )


def test_private_profile_requires_follow() -> None:
    target = _target(private=True)
    viewer = uuid.uuid4()
    assert (
        can_view_profile(
            viewer_id=None,
            target=target,
            follows_target=False,
            blocked_either_way=False,
        )
        is False
    )
    assert (
        can_view_profile(
            viewer_id=viewer,
            target=target,
            follows_target=False,
            blocked_either_way=False,
        )
        is False
    )
    assert (
        can_view_profile(
            viewer_id=viewer,
            target=target,
            follows_target=True,
            blocked_either_way=False,
        )
        is True
    )


def test_owner_always_sees_own_active_profile() -> None:
    owner = uuid.uuid4()
    target = ProfileTarget(
        user_id=owner, account_status=AccountStatus.ACTIVE, is_private=True
    )
    assert (
        can_view_profile(
            viewer_id=owner,
            target=target,
            follows_target=False,
            blocked_either_way=False,
        )
        is True
    )


def test_block_hides_both_directions() -> None:
    target = _target()
    assert (
        can_view_profile(
            viewer_id=uuid.uuid4(),
            target=target,
            follows_target=True,
            blocked_either_way=True,
        )
        is False
    )


def test_inactive_accounts_invisible() -> None:
    for status in (
        AccountStatus.SUSPENDED,
        AccountStatus.DEACTIVATED,
        AccountStatus.DELETED,
    ):
        target = _target(status=status)
        assert (
            can_view_profile(
                viewer_id=target.user_id,
                target=target,
                follows_target=False,
                blocked_either_way=False,
            )
            is False
        )


def test_relationship_rules() -> None:
    me = uuid.uuid4()
    other = _target()
    assert (
        can_initiate_relationship(
            viewer_id=me, target=other, blocked_either_way=False
        )
        is True
    )
    # No self-relationships.
    assert (
        can_initiate_relationship(
            viewer_id=me,
            target=ProfileTarget(
                user_id=me,
                account_status=AccountStatus.ACTIVE,
                is_private=False,
            ),
            blocked_either_way=False,
        )
        is False
    )
    # Blocks and inactive targets deny.
    assert (
        can_initiate_relationship(
            viewer_id=me, target=other, blocked_either_way=True
        )
        is False
    )
    assert (
        can_initiate_relationship(
            viewer_id=me,
            target=_target(status=AccountStatus.SUSPENDED),
            blocked_either_way=False,
        )
        is False
    )
