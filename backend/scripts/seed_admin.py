"""Bootstrap the first administrator. Run with direct DB access.

The deployer running this script IS the trust root: granting the very
first admin role cannot happen through the API (which correctly forbids
self-grants), so it happens here, once, and is audited.

Usage:
    uv run python scripts/seed_admin.py --email admin@example.com [--role moderator]

Idempotent: existing grants are left untouched.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session  # noqa: E402

from app.infrastructure.database.repositories import (  # noqa: E402
    audit_repository,
    rbac_repository,
    user_repository,
)
from app.infrastructure.database.session import engine  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--role", default="admin")
    args = parser.parse_args()

    with Session(engine) as db:
        user = user_repository.get_by_email(db, args.email)
        if user is None:
            print(f"no such user: {args.email}")
            raise SystemExit(1)
        role = rbac_repository.get_role_by_name(db, args.role)
        if role is None:
            print(f"no such role: {args.role} (run seed_rbac.py first)")
            raise SystemExit(1)
        held = {r.name for r in rbac_repository.roles_of_user(db, user.id)}
        if role.name in held:
            print(f"{user.username} already holds '{role.name}'")
            return
        rbac_repository.grant_role(
            db, user_id=user.id, role_id=role.id, granted_by=None
        )
        audit_repository.record(
            db,
            action="admin.bootstrap",
            actor_id=None,
            target_type="user",
            target_id=str(user.id),
            meta={"role": role.name, "via": "seed_admin"},
        )
        print(f"granted '{role.name}' to {user.username} (audited)")


if __name__ == "__main__":
    main()
