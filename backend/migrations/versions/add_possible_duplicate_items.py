"""Add possible duplicate markers to clothing items.

Revision ID: d6f4a2c9b8e1
Revises: 0b7c8d9e1f2a
Create Date: 2026-06-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "d6f4a2c9b8e1"
down_revision: str | None = "0b7c8d9e1f2a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "clothing_items",
        sa.Column("possible_duplicate", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "clothing_items",
        sa.Column("duplicate_of_item_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("clothing_items", sa.Column("duplicate_distance", sa.Integer(), nullable=True))
    op.create_index(
        "ix_clothing_items_duplicate_of_item_id",
        "clothing_items",
        ["duplicate_of_item_id"],
    )
    op.create_foreign_key(
        "fk_clothing_items_duplicate_of_item_id",
        "clothing_items",
        "clothing_items",
        ["duplicate_of_item_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("clothing_items", "possible_duplicate", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "fk_clothing_items_duplicate_of_item_id", "clothing_items", type_="foreignkey"
    )
    op.drop_index("ix_clothing_items_duplicate_of_item_id", table_name="clothing_items")
    op.drop_column("clothing_items", "duplicate_distance")
    op.drop_column("clothing_items", "duplicate_of_item_id")
    op.drop_column("clothing_items", "possible_duplicate")
