"""m7 search indexes

Revision ID: 58e70a922c9e
Revises: 90b8435cbaae
Create Date: 2026-10-16 16:05:44.762058

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = '58e70a922c9e'
down_revision: Union[str, None] = '90b8435cbaae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_username_trgm "
        "ON users USING gin (username gin_trgm_ops);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_display_name_trgm "
        "ON users USING gin (display_name gin_trgm_ops);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_posts_caption_tsv ON posts "
        "USING gin (to_tsvector('english', coalesce(caption, '')));"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_hashtags_tag_trgm "
        "ON hashtags USING gin (tag gin_trgm_ops);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_hashtags_tag_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_posts_caption_tsv;")
    op.execute("DROP INDEX IF EXISTS ix_users_display_name_trgm;")
    op.execute("DROP INDEX IF EXISTS ix_users_username_trgm;")
    # Extension kept: harmless and possibly shared.
