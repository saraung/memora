"""media owner set null on user delete

Revision ID: 40f29582c58b
Revises: 60b736c726fa
Create Date: 2026-10-16 17:33:59.374013

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '40f29582c58b'
down_revision: Union[str, None] = '60b736c726fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("media_assets_owner_id_fkey", "media_assets", type_="foreignkey")
    op.alter_column(
        "media_assets", "owner_id", nullable=True, existing_type=sa.Uuid()
    )
    op.create_foreign_key(
        "media_assets_owner_id_fkey",
        "media_assets",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("media_assets_owner_id_fkey", "media_assets", type_="foreignkey")
    # Ownerless assets cannot satisfy NOT NULL: drop them.
    op.execute("DELETE FROM media_assets WHERE owner_id IS NULL")
    op.alter_column(
        "media_assets", "owner_id", nullable=False, existing_type=sa.Uuid()
    )
    op.create_foreign_key(
        "media_assets_owner_id_fkey",
        "media_assets",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="CASCADE",
    )
