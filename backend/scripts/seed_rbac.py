"""Seed initial staff roles and permissions. Idempotent.

Usage: uv run python scripts/seed_rbac.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session, select  # noqa: E402

from app.infrastructure.database.models.rbac import RolePermission  # noqa: E402
from app.infrastructure.database.repositories import rbac_repository  # noqa: E402
from app.infrastructure.database.session import engine  # noqa: E402
from app.modules.authorization import permissions as perm  # noqa: E402

ROLE_GRANTS: dict[str, tuple[str, tuple[str, ...]]] = {
    "admin": (
        "Full platform administrator",
        tuple(code for code, _ in perm.ALL_PERMISSIONS),
    ),
    "moderator": (
        "Reviews reports and moderates content",
        (
            perm.REPORTS_READ,
            perm.REPORTS_REVIEW,
            perm.CONTENT_REMOVE,
            perm.USERS_READ,
        ),
    ),
    "support": (
        "Assists users with account issues",
        (perm.USERS_READ,),
    ),
}


def main() -> None:
    with Session(engine) as db:
        for code, description in perm.ALL_PERMISSIONS:
            if rbac_repository.get_permission_by_code(db, code) is None:
                rbac_repository.create_permission(
                    db, code=code, description=description
                )
                print(f"permission: {code}")

        for role_name, (role_desc, grants) in ROLE_GRANTS.items():
            role = rbac_repository.get_role_by_name(db, role_name)
            if role is None:
                role = rbac_repository.create_role(
                    db, name=role_name, description=role_desc
                )
                print(f"role: {role_name}")
            for code in grants:
                permission = rbac_repository.get_permission_by_code(db, code)
                assert permission is not None, f"missing permission {code}"
                link = db.exec(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == permission.id,
                    )
                ).first()
                if link is None:
                    rbac_repository.grant_permission_to_role(
                        db, role_id=role.id, permission_id=permission.id
                    )
                    print(f"grant: {role_name} <- {code}")
    print("RBAC seed complete")


if __name__ == "__main__":
    main()
