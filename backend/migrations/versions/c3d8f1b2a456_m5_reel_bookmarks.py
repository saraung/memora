"""m5 reel bookmarks

Revision ID: c3d8f1b2a456
Revises: b7c1e9a4f230
Create Date: 2026-10-17 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d8f1b2a456'
down_revision: Union[str, None] = 'b7c1e9a4f230'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reel_bookmarks',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('reel_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reel_id'], ['reels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'reel_id'),
    )
    op.create_index(
        op.f('ix_reel_bookmarks_reel_id'),
        'reel_bookmarks',
        ['reel_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_reel_bookmarks_reel_id'), table_name='reel_bookmarks'
    )
    op.drop_table('reel_bookmarks')
