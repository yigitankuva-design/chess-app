"""custom_tabs ve custom_tab_sections tablolari — ozel sekme olusturucu (B grubu)

Revision ID: CustomTabs
Revises: BotGameColor

Yalnizca YENI tablolar olusturur. Mevcut hicbir tabloya/sutuna/veriye dokunmaz
(KURAL #3). TRUNCATE/DELETE yoktur.
"""
import sqlalchemy as sa
from alembic import op

revision = "CustomTabs"
down_revision = "BotGameColor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "custom_tabs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=60), nullable=False),
        sa.Column("emoji", sa.String(length=10), nullable=False),
    )
    op.create_table(
        "custom_tab_sections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("custom_tab_id", sa.Integer(), sa.ForeignKey("custom_tabs.id"), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("images", sa.JSON(), nullable=False),
    )
    op.create_index("ix_custom_tab_sections_custom_tab_id", "custom_tab_sections", ["custom_tab_id"])


def downgrade() -> None:
    op.drop_index("ix_custom_tab_sections_custom_tab_id", table_name="custom_tab_sections")
    op.drop_table("custom_tab_sections")
    op.drop_table("custom_tabs")
