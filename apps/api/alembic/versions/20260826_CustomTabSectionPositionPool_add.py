"""custom_tab_sections.position_pool kolonu — Alt Konu Konum Havuzu (gruplu)

Revision ID: SectionPosPool
Revises: SectionExplCards

Bir gün önce eklenen `explanation_cards` (madde 2026-08-25) hiçbir ortamda
gerçek veriyle KULLANILMADI — yerel Postgres bile ayakta değildi, bu yüzden
migration hiç uygulanmamıştı. Zafer hocanın gönderdiği yeni görsel referans
(madde 2026-08-26) veri şeklini kökten değiştirdi: artık "Konum Havuzu"
tek düz kartlar değil, her biri KENDİ kod numarasıyla eklenen ve İÇİNDE
birden çok numaralı ADIM (fen+cümle+hamle sırası) barındıran GRUPLAR. Bu
yüzden geriye dönük veri taşımaya gerek kalmadan sütun DEĞİŞTİRİLİYOR.
"""
import sqlalchemy as sa
from alembic import op

revision = "SectionPosPool"
down_revision = "SectionExplCards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("custom_tab_sections", "explanation_cards")
    op.add_column(
        "custom_tab_sections",
        sa.Column("position_pool", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "position_pool")
    op.add_column(
        "custom_tab_sections",
        sa.Column("explanation_cards", sa.JSON(), nullable=False, server_default="[]"),
    )
