"""openings.sort_order ekle (madde 8 - siralama)

Revision ID: OpeningSortOrder
Revises: GameClock
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa

revision = "OpeningSortOrder"
down_revision = "GameClock"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "openings",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    # Mevcut kayitlarda id sirasi korunsun diye sort_order = id ile doldurulur.
    op.execute("UPDATE openings SET sort_order = id")


def downgrade() -> None:
    op.drop_column("openings", "sort_order")
