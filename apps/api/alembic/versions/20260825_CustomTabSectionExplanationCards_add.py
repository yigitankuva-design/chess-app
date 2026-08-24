"""custom_tab_sections.explanation_cards kolonu — Alt Konu açıklama kartları

Revision ID: SectionExplCards
Revises: SectionBoardEx

Antrenör/Dersler/Düzey/Konu/Alt Konu'da hocanın tahtanın solundaki numaralı
dairesel kartlara girdiği açıklama kartları (madde: 2026-08-25) — her biri
bir konum (fen) + bir açıklama cümlesi. Hızlı Erişim'deki Alt Konu sayfasında
bir karta tıklanınca o konum tahtada açılır ve cümlesi altta gösterilir.
Yalnızca YENİ bir kolon eklenir, server_default='[]' ile — mevcut satırlar
etkilenmez (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "SectionExplCards"
down_revision = "SectionBoardEx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("explanation_cards", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "explanation_cards")
