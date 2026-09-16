""""Online Ders Oluştur" bölümünü "Canlı Ders Oluştur" olarak yeniden adlandır

Revision ID: CanliDersOlusturRename
Revises: AdayHamleSessionCreate

Madde 2026-09-16 (madde 1): Zafer "Online Ders" teriminin uygulama genelinde
"Canlı Ders" olarak kullanılmasını istedi. Bu bölümün section_kind'i
('online_ders_olustur') KALICI kimlik olduğu için değişmiyor — sadece
görünen başlık güncelleniyor.
"""
from alembic import op

revision = "CanliDersOlusturRename"
down_revision = "AdayHamleSessionCreate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE custom_tab_sections
        SET title = 'Canlı Ders Oluştur'
        WHERE section_kind = 'online_ders_olustur' AND title = 'Online Ders Oluştur'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE custom_tab_sections
        SET title = 'Online Ders Oluştur'
        WHERE section_kind = 'online_ders_olustur' AND title = 'Canlı Ders Oluştur'
        """
    )
