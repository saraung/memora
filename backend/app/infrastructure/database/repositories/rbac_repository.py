"""Persistence operations for roles and permissions."""

from __future__ import annotations

import uuid

from sqlmodel import Session, func, select

from app.infrastructure.database.models.rbac import (
    Permission,
    Role,
    RolePermission,
    UserRole,
)


def get_role_by_name(session: Session, name: str) -> Role | None:
    return session.exec(select(Role).where(Role.name == name)).first()


def get_permission_by_code(session: Session, code: str) -> Permission | None:
    return session.exec(
        select(Permission).where(Permission.code == code)
    ).first()


def list_roles(session: Session) -> list[Role]:
    return list(session.exec(select(Role).order_by(Role.name)).all())


def list_permissions(session: Session) -> list[Permission]:
    return list(
        session.exec(select(Permission).order_by(Permission.code)).all()
    )


def create_role(
    session: Session, *, name: str, description: str = ""
) -> Role:
    role = Role(name=name, description=description)
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def save_role(session: Session, role: Role) -> Role:
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def delete_role(session: Session, role: Role) -> None:
    """Delete a role (its permission links cascade at the DB level)."""
    session.delete(role)
    session.commit()


def create_permission(
    session: Session, *, code: str, description: str = ""
) -> Permission:
    permission = Permission(code=code, description=description)
    session.add(permission)
    session.commit()
    session.refresh(permission)
    return permission


def grant_role(
    session: Session,
    *,
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    granted_by: uuid.UUID | None = None,
) -> UserRole:
    link = UserRole(
        user_id=user_id, role_id=role_id, granted_by=granted_by
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def revoke_role(
    session: Session, *, user_id: uuid.UUID, role_id: uuid.UUID
) -> bool:
    """Remove a role assignment. Returns False when absent."""
    link = session.get(UserRole, (user_id, role_id))
    if link is None:
        return False
    session.delete(link)
    session.commit()
    return True


def roles_of_user(session: Session, user_id: uuid.UUID) -> list[Role]:
    """Staff roles currently held by a user."""
    return list(
        session.exec(
            select(Role)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
            .order_by(Role.name.asc())
        ).all()
    )


def count_role_holders(session: Session, role_id: uuid.UUID) -> int:
    return (
        session.exec(
            select(func.count())
            .select_from(UserRole)
            .where(UserRole.role_id == role_id)
        ).one()
        or 0
    )


def permission_codes_for_role(
    session: Session, role_id: uuid.UUID
) -> list[str]:
    """Permission codes granted to a role (for staff management UI)."""
    return list(
        session.exec(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
            .order_by(Permission.code.asc())
        ).all()
    )

def grant_permission_to_role(
    session: Session, *, role_id: uuid.UUID, permission_id: uuid.UUID
) -> RolePermission:
    link = RolePermission(role_id=role_id, permission_id=permission_id)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


def set_role_permissions(
    session: Session, *, role_id: uuid.UUID, permission_ids: list[uuid.UUID]
) -> None:
    """Replace a role's permission set with exactly ``permission_ids``."""
    existing = session.exec(
        select(RolePermission).where(RolePermission.role_id == role_id)
    ).all()
    for link in existing:
        session.delete(link)
    for permission_id in sorted(set(permission_ids), key=str):
        session.add(RolePermission(role_id=role_id, permission_id=permission_id))
    session.commit()


def permission_codes_for_user(
    session: Session, user_id: uuid.UUID
) -> set[str]:
    """Return every permission code granted to a user through roles."""
    rows = session.exec(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .where(UserRole.user_id == user_id)
    ).all()
    return set(rows)
