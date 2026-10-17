"""m5 reel comments

Revision ID: b7c1e9a4f230
Revises: 8e5bf8f0a743
Create Date: 2026-10-17 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'b7c1e9a4f230'
down_revision: Union[str, None] = '8e5bf8f0a743'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reel_comments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('reel_id', sa.Uuid(), nullable=False),
        sa.Column('author_id', sa.Uuid(), nullable=False),
        sa.Column(
            'body',
            sqlmodel.sql.sqltypes.AutoString(length=1000),
            nullable=False,
        ),
        sa.Column('parent_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(
            ['parent_id'], ['reel_comments.id'], ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(['reel_id'], ['reels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_reel_comments_reel_id'),
        'reel_comments',
        ['reel_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_reel_comments_author_id'),
        'reel_comments',
        ['author_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_reel_comments_created_at'),
        'reel_comments',
        ['created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_reel_comments_created_at'), table_name='reel_comments'
    )
    op.drop_index(
        op.f('ix_reel_comments_author_id'), table_name='reel_comments'
    )
    op.drop_index(
        op.f('ix_reel_comments_reel_id'), table_name='reel_comments'
    )
    op.drop_table('reel_comments')
