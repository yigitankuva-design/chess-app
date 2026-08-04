"""custom_tab_sections.practice_positions kolonu — Pratik Yap bot konum havuzu

Revision ID: PracticePositions
Revises: CustomTabs

Yalnızca YENİ bir kolon ekler, server_default='[]' ile — mevcut satırlar
etkilenmez, hiçbir veri silinmez/değişmez (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "PracticePositions"
down_revision = "CustomTabs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("practice_positions", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "practice_positions")
