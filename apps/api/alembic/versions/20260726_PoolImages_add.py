"""pool_images tablosu — görsel havuzu

Revision ID: PoolImages
Revises: PlayFeatures

Yalnizca YENI tablo olusturur. Mevcut hicbir tabloya/sutuna/veriye dokunmaz
(KURAL #3). TRUNCATE/DELETE yoktur.
"""
import sqlalchemy as sa
from alembic import op

revision = "PoolImages"
down_revision = "PlayFeatures"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pool_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("data_uri", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("pool_images")
