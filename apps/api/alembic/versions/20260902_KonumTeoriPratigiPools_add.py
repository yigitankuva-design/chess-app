"""custom_tab_sections.konum_pratigi_pool / teori_pratigi_pool kolonları

Revision ID: KonumTeoriPools
Revises: CustomTabSectionKind

Madde 2026-09-02 (devam): "Açılış Pratiği Yap" a/b/c'ye ayrıldıktan sonra
a) Konum Pratiği (çoktan seçmeli, açılış konumu tanıma sorusu) ve b) Teori
Pratiği (tahtada oynanan, hamle-dizisi doğrulamalı soru) için ayrı ayrı
havuzlar gerekiyor — Kazanç Konumu'nun `practice_positions`'ıyla AYNI
desende, kendi başlarına iki yeni JSON kolon. Her ikisi de BOŞ liste
varsayılanıyla eklenir; mevcut kayıtlar etkilenmez (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "KonumTeoriPools"
down_revision = "CustomTabSectionKind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("konum_pratigi_pool", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column(
        "custom_tab_sections",
        sa.Column("teori_pratigi_pool", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "teori_pratigi_pool")
    op.drop_column("custom_tab_sections", "konum_pratigi_pool")
