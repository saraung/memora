"""Staff administration: reports queue, accounts, roles, audit trail."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, status
from sqlmodel import Session

from app.api.pagination import PageResponse
from app.application.pagination import decode_cursor, encode_cursor
from app.application.services import moderation_service, stats_service
from app.core.exceptions import (
    ForbiddenError,
    ResourceNotFoundError,
    ValidationError,
)
from app.core.middleware import get_request_id
from app.domain.enums import ModerationDecision
from app.infrastructure.database.models.user import User
from app.infrastructure.database.repositories import (
    audit_repository,
    moderation_repository,
    rbac_repository,
    user_repository,
)
from app.infrastructure.database.session import get_session
from app.modules.admin import schemas
from app.modules.authorization import permissions as perm
from app.modules.authorization.dependencies import (
    require_any_permission,
    require_permission,
)
from app.modules.moderation import schemas as mod_schemas
from app.modules.users.schemas import UserSummary

router = APIRouter(prefix="/admin", tags=["admin"])

require_reports_read = require_permission(perm.REPORTS_READ)
require_reports_review = require_permission(perm.REPORTS_REVIEW)
require_users_read = require_permission(perm.USERS_READ)
require_users_suspend = require_permission(perm.USERS_SUSPEND)
require_staff_manage = require_permission(perm.STAFF_MANAGE)
require_audit_read = require_permission(perm.AUDIT_READ)

# Shared by the Overview and Analytics dashboards.
require_stats_read = require_any_permission(
    perm.REPORTS_READ, perm.ANALYTICS_READ
)


def _report_response(
    db: Session, report_id: uuid.UUID
) -> mod_schemas.ReportResponse:
    record = moderation_repository.get_report(db, report_id)
    if record is None:
        raise ResourceNotFoundError("Report not found")
    reporter = (
        user_repository.get_by_id(db, record.reporter_id)
        if record.reporter_id
        else None
    )
    assignee = (
        user_repository.get_by_id(db, record.assigned_to)
        if record.assigned_to
        else None
    )
    return mod_schemas.ReportResponse(
        id=record.id,
        reporter=UserSummary.model_validate(reporter) if reporter else None,
        target_type=record.target_type,
        target_id=record.target_id,
        category=record.category.value,
        details=record.details,
        status=record.status.value,
        assignee=UserSummary.model_validate(assignee) if assignee else None,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get("/stats", response_model=schemas.OverviewStatsResponse)
def get_overview_stats(
    days: int = Query(default=14, ge=1, le=90),
    current_user: User = Depends(require_stats_read),
    db: Session = Depends(get_session),
) -> schemas.OverviewStatsResponse:
    """Platform-wide aggregates + time series for the staff dashboards."""
    _ = current_user
    payload = stats_service.overview(db, days=days)
    return schemas.OverviewStatsResponse.model_validate(payload)


@router.get("/reports", response_model=PageResponse[mod_schemas.ReportResponse])
def list_reports(
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(require_reports_read),
    db: Session = Depends(get_session),
) -> PageResponse[mod_schemas.ReportResponse]:
    _ = current_user
    page = moderation_service.list_reports(
        db, status=status, category=category, limit=limit, cursor=cursor
    )
    return PageResponse(
        items=[_report_response(db, r.id) for r in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


@router.get(
    "/reports/{report_id}",
    response_model=mod_schemas.ReportDetailResponse,
)
def get_report(
    report_id: uuid.UUID,
    current_user: User = Depends(require_reports_read),
    db: Session = Depends(get_session),
) -> mod_schemas.ReportDetailResponse:
    _ = current_user
    base = _report_response(db, report_id)
    actions = [
        mod_schemas.ModerationActionResponse(
            id=a.id,
            moderator_id=a.moderator_id,
            target_type=a.target_type,
            target_id=a.target_id,
            decision=a.decision.value,
            reason=a.reason,
            created_at=a.created_at,
        )
        for a in moderation_repository.list_actions_for_report(db, report_id)
    ]
    return mod_schemas.ReportDetailResponse(**base.model_dump(), actions=actions)


@router.post(
    "/reports/{report_id}/actions",
    response_model=mod_schemas.ReportResponse,
)
def decide_report(
    report_id: uuid.UUID,
    body: mod_schemas.DecideReportRequest,
    request: Request,
    current_user: User = Depends(require_reports_review),
    db: Session = Depends(get_session),
) -> mod_schemas.ReportResponse:
    if body.decision == ModerationDecision.REMOVE_CONTENT:
        granted = rbac_repository.permission_codes_for_user(db, current_user.id)
        if perm.CONTENT_REMOVE not in granted:
            raise ForbiddenError(
                "You do not have permission to remove content",
                code="FORBIDDEN",
            )
    moderation_service.decide_report(
        db,
        moderator=current_user,
        report_id=report_id,
        decision=body.decision,
        reason=body.reason,
        request_id=get_request_id(request),
    )
    return _report_response(db, report_id)


def _admin_user(db: Session, user: User) -> schemas.AdminUserResponse:
    roles = [r.name for r in rbac_repository.roles_of_user(db, user.id)]
    return schemas.AdminUserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        account_status=user.account_status.value,
        is_verified=user.is_verified,
        is_private=user.is_private,
        roles=roles,
        created_at=user.created_at,
    )


@router.get("/users", response_model=PageResponse[schemas.AdminUserResponse])
def search_users(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(require_users_read),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.AdminUserResponse]:
    _ = current_user
    page = moderation_service.search_users(
        db, query=q, limit=limit, cursor=cursor
    )
    return PageResponse(
        items=[_admin_user(db, u) for u in page.items],
        next_cursor=page.next_cursor,
        has_more=page.has_more,
    )


def _admin_user_detail(
    db: Session, detail: moderation_service.UserDetail
) -> schemas.AdminUserDetailResponse:
    _ = db
    base = _admin_user(db, detail.user)
    return schemas.AdminUserDetailResponse(
        **base.model_dump(),
        followers=detail.followers,
        following=detail.following,
        posts=detail.posts,
        recent_reports=[
            schemas.UserReportRef(
                id=report.id,
                category=report.category.value,
                status=report.status.value,
                created_at=report.created_at,
            )
            for report in detail.recent_reports
        ],
    )


@router.get(
    "/users/{user_id}", response_model=schemas.AdminUserDetailResponse
)
def get_user_detail(
    user_id: uuid.UUID,
    current_user: User = Depends(require_users_read),
    db: Session = Depends(get_session),
) -> schemas.AdminUserDetailResponse:
    _ = current_user
    detail = moderation_service.get_user_detail(db, user_id)
    return _admin_user_detail(db, detail)


@router.get("/staff", response_model=list[schemas.StaffMemberResponse])
def list_staff(
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> list[schemas.StaffMemberResponse]:
    _ = current_user
    return [
        schemas.StaffMemberResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            display_name=user.display_name,
            account_status=user.account_status.value,
            roles=roles,
            created_at=user.created_at,
        )
        for user, roles in moderation_service.list_staff(db)
    ]


@router.patch(
    "/users/{user_id}/status", response_model=schemas.AdminUserResponse
)
def set_account_status(
    user_id: uuid.UUID,
    body: schemas.AccountStatusRequest,
    request: Request,
    current_user: User = Depends(require_users_suspend),
    db: Session = Depends(get_session),
) -> schemas.AdminUserResponse:
    user = moderation_service.set_account_status(
        db,
        actor=current_user,
        user_id=user_id,
        status=body.status,
        reason=body.reason,
        request_id=get_request_id(request),
    )
    return _admin_user(db, user)


def _role_response(view: moderation_service.RoleView) -> schemas.RoleResponse:
    return schemas.RoleResponse(
        name=view.role.name,
        description=view.role.description,
        permissions=view.permissions,
        holders=view.holders,
    )


@router.get("/roles", response_model=list[schemas.RoleResponse])
def list_roles(
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> list[schemas.RoleResponse]:
    _ = current_user
    return [_role_response(view) for view in moderation_service.list_role_catalog(db)]


@router.get("/permissions", response_model=list[schemas.PermissionResponse])
def list_permissions(
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> list[schemas.PermissionResponse]:
    _ = current_user
    return [
        schemas.PermissionResponse(code=p.code, description=p.description)
        for p in moderation_service.list_permission_catalog(db)
    ]


@router.post(
    "/roles",
    response_model=schemas.RoleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_role(
    body: schemas.RoleCreateRequest,
    request: Request,
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> schemas.RoleResponse:
    view = moderation_service.create_staff_role(
        db,
        actor=current_user,
        name=body.name,
        description=body.description,
        permissions=body.permissions,
        request_id=get_request_id(request),
    )
    return _role_response(view)


@router.patch("/roles/{role_name}", response_model=schemas.RoleResponse)
def update_role(
    role_name: str,
    body: schemas.RoleUpdateRequest,
    request: Request,
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> schemas.RoleResponse:
    view = moderation_service.update_staff_role(
        db,
        actor=current_user,
        name=role_name,
        description=body.description,
        permissions=body.permissions,
        request_id=get_request_id(request),
    )
    return _role_response(view)


@router.delete("/roles/{role_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_name: str,
    request: Request,
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> None:
    moderation_service.delete_staff_role(
        db,
        actor=current_user,
        name=role_name,
        request_id=get_request_id(request),
    )


@router.post("/users/{user_id}/roles", response_model=schemas.AdminUserResponse)
def grant_role(
    user_id: uuid.UUID,
    body: schemas.RoleAssignmentRequest,
    request: Request,
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> schemas.AdminUserResponse:
    moderation_service.grant_staff_role(
        db,
        actor=current_user,
        user_id=user_id,
        role_name=body.role.strip().lower(),
        request_id=get_request_id(request),
    )
    user = user_repository.get_by_id(db, user_id)
    assert user is not None
    return _admin_user(db, user)


@router.delete(
    "/users/{user_id}/roles/{role_name}",
    response_model=schemas.AdminUserResponse,
)
def revoke_role(
    user_id: uuid.UUID,
    role_name: str,
    request: Request,
    current_user: User = Depends(require_staff_manage),
    db: Session = Depends(get_session),
) -> schemas.AdminUserResponse:
    moderation_service.revoke_staff_role(
        db,
        actor=current_user,
        user_id=user_id,
        role_name=role_name.strip().lower(),
        request_id=get_request_id(request),
    )
    user = user_repository.get_by_id(db, user_id)
    assert user is not None
    return _admin_user(db, user)


@router.get(
    "/audit-events", response_model=PageResponse[schemas.AuditEventResponse]
)
def list_audit_events(
    actor_id: uuid.UUID | None = Query(default=None),
    action: str | None = Query(default=None),
    target_type: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(require_audit_read),
    db: Session = Depends(get_session),
) -> PageResponse[schemas.AuditEventResponse]:
    _ = current_user
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
    rows = audit_repository.list_events_before(
        db,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        since=None,
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
    return PageResponse(
        items=[
            schemas.AuditEventResponse(
                id=r.id,
                actor_id=r.actor_id,
                action=r.action,
                target_type=r.target_type,
                target_id=r.target_id,
                request_id=r.request_id,
                meta=r.meta,
                created_at=r.created_at,
            )
            for r in rows[:limit]
        ],
        next_cursor=next_cursor,
        has_more=has_more,
    )
