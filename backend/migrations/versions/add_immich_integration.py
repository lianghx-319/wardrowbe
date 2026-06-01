"""Add Immich integration tables and item source metadata.

Revision ID: f4a1b2c3d4e5
Revises: e1f2g3h4i5j6
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f4a1b2c3d4e5"
down_revision: str | None = "e1f2g3h4i5j6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    immich_status = postgresql.ENUM(
        "connected", "error", name="immich_connection_status", create_type=False
    )
    image_source = postgresql.ENUM("local", "immich", name="image_source", create_type=False)
    immich_status.create(op.get_bind(), checkfirst=True)
    image_source.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "immich_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=False),
        sa.Column("album_id", sa.String(length=128), nullable=False),
        sa.Column("album_name", sa.String(length=255), nullable=False),
        sa.Column("status", immich_status, nullable=False),
        sa.Column("last_scan_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.add_column("clothing_items", sa.Column("image_source", image_source, nullable=True))
    op.add_column(
        "clothing_items",
        sa.Column("immich_connection_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("clothing_items", sa.Column("immich_asset_id", sa.String(length=128)))
    op.add_column("clothing_items", sa.Column("immich_checksum", sa.String(length=128)))
    op.add_column("clothing_items", sa.Column("immich_original_filename", sa.String(length=500)))
    op.alter_column("clothing_items", "image_path", existing_type=sa.String(length=500), nullable=True)
    op.execute("UPDATE clothing_items SET image_source = 'local' WHERE image_source IS NULL")
    op.alter_column("clothing_items", "image_source", nullable=False)
    op.create_index("ix_clothing_items_immich_connection_id", "clothing_items", ["immich_connection_id"])
    op.create_index("ix_clothing_items_immich_asset_id", "clothing_items", ["immich_asset_id"])
    op.create_index("ix_clothing_items_immich_checksum", "clothing_items", ["immich_checksum"])
    op.create_foreign_key(
        "fk_clothing_items_immich_connection_id",
        "clothing_items",
        "immich_connections",
        ["immich_connection_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_clothing_items_immich_connection_id", "clothing_items", type_="foreignkey")
    op.drop_index("ix_clothing_items_immich_checksum", table_name="clothing_items")
    op.drop_index("ix_clothing_items_immich_asset_id", table_name="clothing_items")
    op.drop_index("ix_clothing_items_immich_connection_id", table_name="clothing_items")
    op.alter_column("clothing_items", "image_path", existing_type=sa.String(length=500), nullable=False)
    op.drop_column("clothing_items", "immich_original_filename")
    op.drop_column("clothing_items", "immich_checksum")
    op.drop_column("clothing_items", "immich_asset_id")
    op.drop_column("clothing_items", "immich_connection_id")
    op.drop_column("clothing_items", "image_source")
    op.drop_table("immich_connections")
    postgresql.ENUM(name="image_source").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="immich_connection_status").drop(op.get_bind(), checkfirst=True)
