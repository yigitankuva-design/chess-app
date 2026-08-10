"""openings.category kolonu — e4 / d4 / diger

Revision ID: OpeningCategory
Revises: PracticePositions

Yalnızca YENİ bir kolon ekler, server_default='diger' ile — mevcut açılışlar
"Diğerleri" grubunda görünür, hiçbir satır silinmez/değişmez (KURAL #3, #4).
"""
import sqlalchemy as sa
from alembic import op

revision = "OpeningCategory"
down_revision = "PracticePositions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "openings",
        sa.Column("category", sa.String(20), nullable=False, server_default="diger"),
    )


def downgrade() -> None:
    op.drop_column("openings", "category")
