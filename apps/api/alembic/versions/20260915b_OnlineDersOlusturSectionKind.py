""""Online Ders Oluştur" bölümünü section_kind='online_ders_olustur' ile işaretle

Revision ID: OnlineDersOlusturSectionKind
Revises: LiveLessonsCreate

Madde 2026-09-15 (düzeltme): "Online Dersler" özelliği önce bağımsız bir
üst-seviye sekme olarak kodlandı; Zafer bunu istemedi — ders oluşturma
akışı, antrenörün "Çalışmalar" sekmesine kendi eklediği "Online Ders
Oluştur" bölümüne bağlanmalı (Sınıflarım/section_kind='siniflarim' ile
BİREBİR AYNI desen, bkz. SiniflarimSectionKind migration'ı). Bölüm zaten
elle oluşturulmuş (parent_id IS NULL, section_kind henüz NULL) — bu
migration onu geriye dönük olarak işaretler.
"""
from alembic import op

revision = "OnlineDersOlusturSectionKind"
down_revision = "LiveLessonsCreate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE custom_tab_sections
        SET section_kind = 'online_ders_olustur'
        WHERE parent_id IS NULL
          AND section_kind IS NULL
          AND title LIKE 'Online Ders Oluştur%'
        """
    )


def downgrade() -> None:
    op.execute(
        "UPDATE custom_tab_sections SET section_kind = NULL WHERE section_kind = 'online_ders_olustur'"
    )
