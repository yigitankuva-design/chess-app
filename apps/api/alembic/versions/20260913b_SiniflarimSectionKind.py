""""Sınıflarım" bölümünü section_kind='siniflarim' ile işaretle (düzeltme)

Revision ID: SiniflarimSectionKind
Revises: SiniflarimKind

Madde 2026-09-13 (düzeltme): önceki SiniflarimKind migration'ı YANLIŞ
tabloyu hedefliyordu — "Sınıflarım" bir üst-seviye CustomTab (custom_tabs)
DEĞİL, antrenörün "Çalışmalar" sekmesinin İÇİNDE, admin tarafından eklenmiş
kök-seviye bir BÖLÜM (custom_tab_sections, parent_id IS NULL) — TIPKI
"Dersler" kökü (section_kind='dersler_root') gibi. Production'da
`GET /custom-tabs` sorgulanınca üst seviyede sadece "Pratik" ve
"Çalışmalar" görüldü; "Sınıflarım" (id 16) `GET /custom-tabs/4` içinde
`parent_id: null` bir bölüm olarak bulundu. Önceki migration bu yüzden
HİÇBİR satırı güncellemedi (0 etki) — production'da hâlâ mevcut, ama artık
zararsız (kind hâlâ NULL, hiçbir custom_tabs satırı "Sınıflarım" ile
başlamıyor).

Bu migration DerslerRootKind'ın (20260908) BİREBİR AYNI deseni: kök
seviyedeki (parent_id IS NULL), başlığı "Sınıflarım" ile BAŞLAYAN, henüz
hiçbir section_kind'i olmayan bölümü işaretler.
"""
from alembic import op

revision = "SiniflarimSectionKind"
down_revision = "SiniflarimKind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE custom_tab_sections
        SET section_kind = 'siniflarim'
        WHERE parent_id IS NULL
          AND section_kind IS NULL
          AND title LIKE 'Sınıflarım%'
        """
    )


def downgrade() -> None:
    op.execute(
        "UPDATE custom_tab_sections SET section_kind = NULL WHERE section_kind = 'siniflarim'"
    )
