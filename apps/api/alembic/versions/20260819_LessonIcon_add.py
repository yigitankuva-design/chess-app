"""lessons.icon kolonu — ders ikonu (admin ikon havuzundan seçer)

Revision ID: LessonIcon
Revises: OpeningCategory

Yalnızca YENİ, nullable bir kolon ekler — mevcut derslerin hiçbiri
etkilenmez (KURAL #3, #4). NULL ise sporcu tarafı eski sıralı-emoji
davranışına düşer (📘 sabiti).
"""
import sqlalchemy as sa
from alembic import op

revision = "LessonIcon"
down_revision = "OpeningCategory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lessons",
        sa.Column("icon", sa.String(10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lessons", "icon")
