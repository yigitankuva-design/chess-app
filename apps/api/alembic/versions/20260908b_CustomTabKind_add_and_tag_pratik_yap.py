"""CustomTab.kind eklenir + "Pratik Yap" sekmesi işaretlenir

Revision ID: CustomTabKind
Revises: DerslerRootKind

Madde 2026-09-08: "Dersler" bölümünde yaşanan AYNI sorunun bir benzeri —
"Pratik Yap" sekmesinin özel arayüzü (bota karşı pratik, Açılış/Kazanç/
Oyunsonu) sekmenin BAŞLIĞININ tam olarak "Pratik Yap" olmasına bakılarak
çalışıyordu (bkz. CustomTabPanel.tsx `isPratikYap`, admin/settings/tabs/
page.tsx `PRATIK_YAP_LABEL`). Zafer bu sekmeyi "Pratik" olarak yeniden
adlandırınca özellik kayboldu. Bu migration:
1. `custom_tabs.kind` sütununu ekler (nullable, plain string — native
   enum DEĞİL, CustomTabSection.section_kind ile AYNI şema deseni; bu
   yüzden şema+veri değişikliği AYNI migration'da güvenle birleşebiliyor
   — UserRole enum'ındaki gibi ayrı deploy'a bölmeye gerek yok).
2. Halihazırda var olan "Pratik Yap" sekmesini `kind='pratik_yap'` ile
   işaretler — İSME göre DEĞİL, YAPISAL kanıta göre bulur: section_kind'i
   'opening'/'kazanc'/'oyunsonu' olan bölümleri barındıran sekme HER ZAMAN
   budur (bu üç section_kind SADECE bu sekmenin FIXED_SECTIONS auto-heal
   mantığıyla oluşturulur).
"""
import sqlalchemy as sa
from alembic import op

revision = "CustomTabKind"
down_revision = "DerslerRootKind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("custom_tabs", sa.Column("kind", sa.String(length=20), nullable=True))
    op.execute(
        """
        UPDATE custom_tabs
        SET kind = 'pratik_yap'
        WHERE kind IS NULL
          AND id IN (
            SELECT DISTINCT custom_tab_id FROM custom_tab_sections
            WHERE section_kind IN ('opening', 'kazanc', 'oyunsonu')
          )
        """
    )


def downgrade() -> None:
    op.drop_column("custom_tabs", "kind")
