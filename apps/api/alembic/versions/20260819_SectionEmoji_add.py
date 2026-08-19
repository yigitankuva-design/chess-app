"""custom_tab_sections.emoji kolonu — bölüm ikonu (admin ikon havuzundan seçer)

Revision ID: SectionEmoji
Revises: LessonIcon

Yalnızca YENİ, nullable bir kolon ekler — mevcut bölümlerin hiçbiri
etkilenmez (KURAL #3, #4). NULL ise sporcu tarafı eski davranışa düşer:
Pratik Yap'ın sabit bölümleri (Kazanç Konumu/Oyunsonu) başlığa göre
🏆/🏁 alır, diğerleri 🎯 varsayılanını kullanır.
"""
import sqlalchemy as sa
from alembic import op

revision = "SectionEmoji"
down_revision = "LessonIcon"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("emoji", sa.String(10), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "emoji")
