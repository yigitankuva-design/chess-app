"""CustomTab.kind: "Antrenör"/"Çalışmalar" sekmesi işaretlenir

Revision ID: CustomTabKindC
Revises: CustomTabKind
Create Date: 2026-09-08

Madde 2026-09-08 (devam): sporcunun Hızlı Erişim'inde (/home) bu sekmeyi
gizleyen filtre ŞİMDİYE KADAR sekmenin BAŞLIĞININ tam olarak "Antrenör"
olmasına bakıyordu (bkz. home/page.tsx). Zafer bu sekmeyi "Çalışmalar"
olarak yeniden adlandırınca filtre artık eşleşmiyor ve sekme sporcu
tarafında YENİDEN görünür oldu — "Dersler" ve "Pratik Yap" ile AYNI kök
sebep, AYNI çözüm: kalıcı `kind` işareti (CustomTab.kind sütunu zaten var,
CustomTabKind migration'ında eklendi).

Bu sekmeyi başlığından BAĞIMSIZ, YAPISAL olarak bulmak için: bu sekmenin
İÇİNDE `section_kind='dersler_root'` ile işaretli "Dersler" kökü bulunur
(bkz. DerslerRootKind migration) — bu işaret SADECE bu tek sekmenin
altında olabilir, başka hiçbir sekmede oluşmaz.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "CustomTabKindC"
down_revision = "CustomTabKind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE custom_tabs
        SET kind = 'antrenor_calismalar'
        WHERE kind IS NULL
          AND id IN (
            SELECT DISTINCT custom_tab_id FROM custom_tab_sections
            WHERE section_kind = 'dersler_root'
          )
        """
    )


def downgrade() -> None:
    op.execute(
        "UPDATE custom_tabs SET kind = NULL WHERE kind = 'antrenor_calismalar'"
    )
