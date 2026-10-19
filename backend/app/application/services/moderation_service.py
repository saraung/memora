"""Reports, moderation decisions, and staff account/role management."""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.application.pagination import decode_cursor, encode_cursor
from app.application.services import notification_service, token_service
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.domain.enums import (
    AccountStatus,
    ModerationDecision,
    NotificationType,
    PostStatus,
    ReelStatus,
    ReportCategory,
    ReportStatus,
    StoryStatus,
)
from app.infrastructure.database.models.messaging import MessageReceipt
from app.infrastructure.database.models.moderation import ModerationAction, Report
from app.infrastructure.database.models.rbac import Role
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    audit_repository,
    content_repository,
    ephemeral_repository,
    media_repository,
    messaging_repository,
    moderation_repository,
    rbac_repository,
    stats_repository,
    user_repository,
)

REPORTABLE_TARGETS = ("user", "post", "comment", "story", "reel", "message")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class ReportDetail:
    reporter: User | None
    target_summary: str
    assignee: User | None


# -- Reports --------------------------------------------------------------


def _resolve_target(
    db: Session, target_type: str, target_id: str
) -> tuple[str, uuid.UUID | None]:
    """Validate a report target; return (summary, owner_id)."""
    if target_type not in REPORTABLE_TARGETS:
        raise ValidationError(
            f"Unknown report target: {target_type}",
            details={"field": "target_type"},
        )
    try:
        tid = uuid.UUID(str(target_id))
    except (ValueError, AttributeError) as exc:
        raise ValidationError("Invalid target id") from exc

    if target_type == "user":
        user = user_repository.get_by_id(db, tid)
        if user is None:
            raise ResourceNotFoundError("Reported account not found")
        return f"@{user.username}", user.id
    if target_type == "post":
        post = content_repository.get_post_by_id(db, tid)
        if post is None:
            raise ResourceNotFoundError("Reported post not found")
        return f"post {post.id}", post.author_id
    if target_type == "comment":
        comment = content_repository.get_comment_by_id(db, tid)
        if comment is None:
            raise ResourceNotFoundError("Reported comment not found")
        return f"comment {comment.id}", comment.author_id
    if target_type == "story":
        story = ephemeral_repository.get_story_by_id(db, tid)
        if story is None:
            raise ResourceNotFoundError("Reported story not found")
        return f"story {story.id}", story.author_id
    if target_type == "reel":
        reel = ephemeral_repository.get_reel_by_id(db, tid)
        if reel is None:
            raise ResourceNotFoundError("Reported reel not found")
        return f"reel {reel.id}", reel.author_id
    message = messaging_repository.get_message_by_id(db, tid)
    if message is None:
        raise ResourceNotFoundError("Reported message not found")
    return f"message {message.id}", message.sender_id


def submit_report(
    db: Session,
    *,
    reporter: User | None,
    target_type: str,
    target_id: str,
    category: str,
    details: str | None,
    request_id: str | None = None,
) -> uuid.UUID:
    """File a report. Reporters may stay anonymous (reporter=None)."""
    try:
        category_enum = ReportCategory(category)
    except ValueError as exc:
        raise ValidationError(
            "Unknown report category", details={"field": "category"}
        ) from exc
    if details is not None and len(details) > 2000:
        raise ValidationError(
            "Details must be at most 2000 characters",
            details={"field": "details"},
        )
    summary, _ = _resolve_target(db, target_type, target_id)
    _ = summary
    report = moderation_repository.create_report(
        db,
        record=Report(
            reporter_id=reporter.id if reporter else None,
            target_type=target_type,
            target_id=target_id,
            category=category_enum,
            details=details.strip() if details and details.strip() else None,
        ),
    )
    _ = request_id
    return report.id


@dataclass
class ReportPage:
    items: list
    next_cursor: str | None
    has_more: bool


def list_reports(
    db: Session,
    *,
    status: str | None,
    category: str | None,
    limit: int,
    cursor: str | None,
) -> ReportPage:
    status_enum = None
    if status:
        try:
            status_enum = ReportStatus(status)
        except ValueError as exc:
            raise ValidationError("Unknown report status") from exc
    category_value = None
    if category:
        try:
            ReportCategory(category)
        except ValueError as exc:
            raise ValidationError("Unknown report category") from exc
        category_value = category
    limit = max(1, min(limit, 50))
    before = None
    if cursor:
        payload = decode_cursor(cursor)
        try:
            before = (
                datetime.fromisoformat(str(payload["c"])),
                uuid.UUID(str(payload["id"])),
            )
        except (ValueError, KeyError) as exc:
            raise ValidationError("Invalid pagination cursor") from exc
    rows = moderation_repository.list_reports_before(
        db,
        status=status_enum,
        category=category_value,
        limit=limit,
        before=before,
    )
    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return ReportPage(items=rows[:limit], next_cursor=next_cursor, has_more=has_more)


def _set_account_status(
    db: Session, user: User, status: AccountStatus
) -> User:
    user.account_status = status
    user = user_repository.save(db, user)
    if status != AccountStatus.ACTIVE:
        token_service.revoke_all_sessions(db, user)
    return user


def decide_report(
    db: Session,
    *,
    moderator: User,
    report_id: uuid.UUID,
    decision: str,
    reason: str,
    request_id: str | None = None,
) -> None:
    """Apply a moderation decision with side effects + audit + notice."""
    try:
        decision_enum = ModerationDecision(decision)
    except ValueError as exc:
        raise ValidationError("Unknown moderation decision") from exc
    reason = reason.strip()
    if not reason:
        raise ValidationError(
            "A reason is required for moderation decisions",
            details={"field": "reason"},
        )
    report = moderation_repository.get_report(db, report_id)
    if report is None:
        raise ResourceNotFoundError("Report not found")
    if report.status in (ReportStatus.ACTION_TAKEN, ReportStatus.DISMISSED):
        raise ConflictError("This report has already been decided")

    summary, owner_id = _resolve_target(
        db, report.target_type, report.target_id
    )
    owner = user_repository.get_by_id(db, owner_id) if owner_id else None
    now = _utcnow()
    expires: datetime | None = None

    if decision_enum == ModerationDecision.DISMISS:
        report.status = ReportStatus.DISMISSED
    elif decision_enum == ModerationDecision.REMOVE_CONTENT:
        _remove_target_content(db, report.target_type, report.target_id)
        report.status = ReportStatus.ACTION_TAKEN
    elif decision_enum == ModerationDecision.WARN:
        report.status = ReportStatus.ACTION_TAKEN
    elif decision_enum in (ModerationDecision.RESTRICT, ModerationDecision.SUSPEND):
        if owner is None:
            raise ConflictError("The target account no longer exists")
        if owner.id == moderator.id:
            raise ForbiddenError("You cannot restrict your own account")
        _set_account_status(db, owner, AccountStatus.SUSPENDED)
        if decision_enum == ModerationDecision.RESTRICT:
            expires = now + timedelta(days=7)
        report.status = ReportStatus.ACTION_TAKEN
    else:  # UNSUSPEND
        if owner is None:
            raise ConflictError("The target account no longer exists")
        _set_account_status(db, owner, AccountStatus.ACTIVE)
        report.status = ReportStatus.ACTION_TAKEN

    report.assigned_to = moderator.id
    moderation_repository.save_report(db, report)
    moderation_repository.create_action(
        db,
        record=ModerationAction(
            moderator_id=moderator.id,
            report_id=report.id,
            target_type=report.target_type,
            target_id=report.target_id,
            decision=decision_enum,
            reason=reason,
            expires_at=expires,
        ),
    )
    audit_repository.record(
        db,
        action="moderation.decide",
        actor_id=moderator.id,
        target_type="report",
        target_id=str(report.id),
        request_id=request_id,
        meta={
            "decision": decision_enum.value,
            "target": f"{report.target_type}:{report.target_id}",
            "reason": reason,
        },
    )
    if owner is not None and owner.id != moderator.id:
        notification_service.notify(
            db,
            recipient_id=owner.id,
            actor_id=None,
            type=NotificationType.MODERATION,
            target_type="report",
            target_id=str(report.id),
        )
    if report.reporter_id is not None and report.reporter_id != moderator.id:
        notification_service.notify(
            db,
            recipient_id=report.reporter_id,
            actor_id=None,
            type=NotificationType.MODERATION,
            target_type="report",
            target_id=str(report.id),
        )


def _remove_target_content(db: Session, target_type: str, target_id: str) -> None:
    tid = uuid.UUID(str(target_id))
    if target_type == "user":
        user = user_repository.get_by_id(db, tid)
        if user is None:
            raise ConflictError("The target account no longer exists")
        _set_account_status(db, user, AccountStatus.SUSPENDED)
    elif target_type == "post":
        post = content_repository.get_post_by_id(db, tid)
        if post is None:
            raise ConflictError("The target post no longer exists")
        post.status = PostStatus.REMOVED
        content_repository.save_post(db, post)
    elif target_type == "comment":
        comment = content_repository.get_comment_by_id(db, tid)
        if comment is None:
            raise ConflictError("The target comment no longer exists")
        comment.body = "[removed by moderation]"
        content_repository.save_comment(db, comment)
    elif target_type == "story":
        story = ephemeral_repository.get_story_by_id(db, tid)
        if story is None:
            raise ConflictError("The target story no longer exists")
        story.status = StoryStatus.DELETED
        ephemeral_repository.save_story(db, story)
    elif target_type == "reel":
        reel = ephemeral_repository.get_reel_by_id(db, tid)
        if reel is None:
            raise ConflictError("The target reel no longer exists")
        reel.status = ReelStatus.REMOVED
        ephemeral_repository.save_reel(db, reel)
    elif target_type == "message":
        message = messaging_repository.get_message_by_id(db, tid)
        if message is None:
            raise ConflictError("The target message no longer exists")
        message.is_deleted = True
        messaging_repository.save_message(db, message)


# -- Staff account management --------------------------------------------------

def set_account_status(
    db: Session,
    *,
    actor: User,
    user_id: uuid.UUID,
    status: str,
    reason: str,
    request_id: str | None = None,
) -> User:
    """Suspend / restore / deactivate an account (audited, notifying)."""
    if user_id == actor.id:
        raise ForbiddenError("You cannot change your own account status")
    try:
        new_status = AccountStatus(status)
    except ValueError as exc:
        raise ValidationError("Unknown account status") from exc
    if new_status == AccountStatus.DELETED:
        raise ValidationError(
            "Accounts cannot be deleted through moderation; "
            "deletion is user-initiated"
        )
    reason = reason.strip()
    if not reason:
        raise ValidationError(
            "A reason is required", details={"field": "reason"}
        )
    target = user_repository.get_by_id(db, user_id)
    if target is None:
        raise ResourceNotFoundError("User not found")
    target = _set_account_status(db, target, new_status)
    audit_repository.record(
        db,
        action="admin.account_status",
        actor_id=actor.id,
        target_type="user",
        target_id=str(target.id),
        request_id=request_id,
        meta={"status": new_status.value, "reason": reason},
    )
    notification_service.notify(
        db,
        recipient_id=target.id,
        actor_id=None,
        type=NotificationType.MODERATION,
        target_type="user",
        target_id=str(target.id),
    )
    return target


@dataclass
class UserPage:
    items: list[User]
    next_cursor: str | None
    has_more: bool


def search_users(
    db: Session, *, query: str, limit: int, cursor: str | None
) -> UserPage:
    query = query.strip()
    if not query:
        raise ValidationError("Search query must not be empty")
    limit = max(1, min(limit, 50))
    before = None
    if cursor:
        payload = decode_cursor(cursor)
        try:
            before = (
                datetime.fromisoformat(str(payload["c"])),
                uuid.UUID(str(payload["id"])),
            )
        except (ValueError, KeyError) as exc:
            raise ValidationError("Invalid pagination cursor") from exc
    rows = user_repository.admin_search_users(
        db, query, limit=limit, before=before
    )
    has_more = len(rows) > limit
    next_cursor = None
    if has_more:
        last = rows[limit - 1]
        next_cursor = encode_cursor(
            {"c": last.created_at.isoformat(), "id": str(last.id)}
        )
    return UserPage(items=rows[:limit], next_cursor=next_cursor, has_more=has_more)


# -- Staff role management --------------------------------------------------------


def grant_staff_role(
    db: Session,
    *,
    actor: User,
    user_id: uuid.UUID,
    role_name: str,
    request_id: str | None = None,
) -> None:
    """Grant a staff role. Never to yourself; audited."""
    if user_id == actor.id:
        raise ForbiddenError("You cannot change your own roles")
    role = rbac_repository.get_role_by_name(db, role_name)
    if role is None:
        raise ResourceNotFoundError("Role not found")
    target = user_repository.get_by_id(db, user_id)
    if target is None:
        raise ResourceNotFoundError("User not found")
    existing = [
        r.name for r in rbac_repository.roles_of_user(db, target.id)
    ]
    if role.name in existing:
        return
    rbac_repository.grant_role(
        db, user_id=target.id, role_id=role.id, granted_by=actor.id
    )
    audit_repository.record(
        db,
        action="admin.role_grant",
        actor_id=actor.id,
        target_type="user",
        target_id=str(target.id),
        request_id=request_id,
        meta={"role": role.name},
    )


def revoke_staff_role(
    db: Session,
    *,
    actor: User,
    user_id: uuid.UUID,
    role_name: str,
    request_id: str | None = None,
) -> None:
    """Revoke a staff role. Protects your own roles and the last admin."""
    if user_id == actor.id:
        raise ForbiddenError("You cannot change your own roles")
    role = rbac_repository.get_role_by_name(db, role_name)
    if role is None:
        raise ResourceNotFoundError("Role not found")
    target = user_repository.get_by_id(db, user_id)
    if target is None:
        raise ResourceNotFoundError("User not found")
    if role.name == "admin" and rbac_repository.count_role_holders(
        db, role.id
    ) <= 1:
        raise ConflictError("Cannot remove the last administrator")
    removed = rbac_repository.revoke_role(
        db, user_id=target.id, role_id=role.id
    )
    if not removed:
        return
    audit_repository.record(
        db,
        action="admin.role_revoke",
        actor_id=actor.id,
        target_type="user",
        target_id=str(target.id),
        request_id=request_id,
        meta={"role": role.name},
    )


# -- Account detail & staff directory ---------------------------------------


@dataclass
class UserDetail:
    user: User
    followers: int
    following: int
    posts: int
    recent_reports: list


def get_user_detail(db: Session, user_id: uuid.UUID) -> UserDetail:
    """Profile, social counts, and recent reports against an account."""
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise ResourceNotFoundError("User not found")
    return UserDetail(
        user=user,
        followers=stats_repository.count_followers(db, user_id),
        following=stats_repository.count_following(db, user_id),
        posts=stats_repository.count_posts_by_author(db, user_id),
        recent_reports=moderation_repository.list_reports_against(
            db, "user", str(user_id), limit=10
        ),
    )


def list_staff(db: Session) -> list[tuple[User, list[str]]]:
    """Every account holding at least one role, with their role names."""
    return stats_repository.list_role_holders(db)


# -- Dashboard metrics -------------------------------------------------------


def platform_overview(db: Session, *, days: int = 14) -> dict:
    """Aggregate platform metrics for the staff overview dashboards."""
    from app.application.services import stats_service

    return stats_service.overview(db, days=days)


# -- Role catalog management -------------------------------------------------

ROLE_NAME_RE = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")
PROTECTED_ROLE = "admin"


@dataclass
class RoleView:
    role: Role
    permissions: list[str]
    holders: int


def list_role_catalog(db: Session) -> list[RoleView]:
    """Roles with their permission codes and member counts."""
    return [
        RoleView(
            role=role,
            permissions=rbac_repository.permission_codes_for_role(db, role.id),
            holders=rbac_repository.count_role_holders(db, role.id),
        )
        for role in rbac_repository.list_roles(db)
    ]


def list_permission_catalog(db: Session) -> list:
    """Every permission code staff can be granted."""
    return rbac_repository.list_permissions(db)


def _resolve_permissions(db: Session, codes: list[str]) -> list:
    unique = sorted({code.strip() for code in codes if code.strip()})
    resolved = []
    for code in unique:
        permission = rbac_repository.get_permission_by_code(db, code)
        if permission is None:
            raise ValidationError(
                f"Unknown permission: {code}",
                details={"field": "permissions"},
            )
        resolved.append(permission)
    return resolved


def create_staff_role(
    db: Session,
    *,
    actor: User,
    name: str,
    description: str,
    permissions: list[str],
    request_id: str | None = None,
) -> RoleView:
    """Create a role and grant it an initial permission set."""
    role_name = name.strip().lower()
    if not ROLE_NAME_RE.match(role_name):
        raise ValidationError(
            "Role names use lowercase letters, digits, dashes or underscores",
            details={"field": "name"},
        )
    if rbac_repository.get_role_by_name(db, role_name) is not None:
        raise ConflictError("A role with that name already exists")
    resolved = _resolve_permissions(db, permissions)
    role = rbac_repository.create_role(
        db, name=role_name, description=description.strip()
    )
    if resolved:
        rbac_repository.set_role_permissions(
            db, role_id=role.id, permission_ids=[p.id for p in resolved]
        )
    audit_repository.record(
        db,
        action="admin.role_create",
        actor_id=actor.id,
        target_type="role",
        target_id=role.name,
        request_id=request_id,
        meta={"permissions": [p.code for p in resolved]},
    )
    return RoleView(
        role=role,
        permissions=rbac_repository.permission_codes_for_role(db, role.id),
        holders=0,
    )


def update_staff_role(
    db: Session,
    *,
    actor: User,
    name: str,
    description: str,
    permissions: list[str],
    request_id: str | None = None,
) -> RoleView:
    """Update a role's description and permission set."""
    role = rbac_repository.get_role_by_name(db, name.strip().lower())
    if role is None:
        raise ResourceNotFoundError("Role not found")
    resolved = _resolve_permissions(db, permissions)
    codes = sorted(p.code for p in resolved)
    if role.name == PROTECTED_ROLE:
        all_codes = sorted(p.code for p in rbac_repository.list_permissions(db))
        if codes != all_codes:
            raise ForbiddenError(
                "The administrator role always retains every permission"
            )
    role.description = description.strip()
    rbac_repository.save_role(db, role)
    rbac_repository.set_role_permissions(
        db, role_id=role.id, permission_ids=[p.id for p in resolved]
    )
    audit_repository.record(
        db,
        action="admin.role_update",
        actor_id=actor.id,
        target_type="role",
        target_id=role.name,
        request_id=request_id,
        meta={"permissions": codes},
    )
    return RoleView(
        role=role,
        permissions=rbac_repository.permission_codes_for_role(db, role.id),
        holders=rbac_repository.count_role_holders(db, role.id),
    )


def delete_staff_role(
    db: Session,
    *,
    actor: User,
    name: str,
    request_id: str | None = None,
) -> None:
    """Delete an empty role. Protected/held roles cannot be removed."""
    role = rbac_repository.get_role_by_name(db, name.strip().lower())
    if role is None:
        raise ResourceNotFoundError("Role not found")
    if role.name == PROTECTED_ROLE:
        raise ForbiddenError("The administrator role cannot be deleted")
    if rbac_repository.count_role_holders(db, role.id) > 0:
        raise ConflictError(
            "Remove every member from this role before deleting it"
        )
    rbac_repository.delete_role(db, role)
    audit_repository.record(
        db,
        action="admin.role_delete",
        actor_id=actor.id,
        target_type="role",
        target_id=role.name,
        request_id=request_id,
        meta=None,
    )

