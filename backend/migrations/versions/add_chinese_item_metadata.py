"""Add Chinese item metadata fields.

Revision ID: 0b7c8d9e1f2a
Revises: f4a1b2c3d4e5
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0b7c8d9e1f2a"
down_revision: str | None = "f4a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clothing_items", sa.Column("ai_description_zh", sa.Text(), nullable=True))
    op.add_column("clothing_items", sa.Column("tags_zh", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("clothing_items", "tags_zh")
    op.drop_column("clothing_items", "ai_description_zh")
