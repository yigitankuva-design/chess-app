"""Görsel Turu A/2: eski yer tutucu "Bildirimler" özel sekmesini sil

Revision ID: DropBildirimlerTab
Revises: NotificationsF4

Madde 2026-09-11 (Görsel Turu A/2): Zafer, gerçek bildirim sistemi (Faz 4,
Hızlı Erişim'deki sabit 🔔 kart) gelmeden önce Admin › Sekmeler'den
"Bildirimler" adında bir özel sekme açmıştı (yer tutucu, işlevi yok). Artık
ana sayfada iki "Bildirimler" kartı görünüyor; Zafer'in kararı: eskisi
silinsin ("tamamen kaldır", tek seferlik migration).

Sadece `label = 'Bildirimler'` VE `kind IS NULL` (yani sistemin işaretlediği
özel bir sekme DEĞİL) olan sekme(ler) ve bölümleri silinir. Gerçek 🔔
Bildirimler koddan gelir, veritabanında kaydı yoktur — etkilenmez.
`custom_tabs`/`custom_tab_sections` müfredat tablosu değildir (bkz.
tests/test_migration_guard.py CONTENT_TABLES).
"""
from alembic import op

revision = "DropBildirimlerTab"
down_revision = "NotificationsF4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ödevlerin izlenebilirlik bağı (Faz 3) bu bölümlerden birini gösteriyorsa
    # önce boşalt — FK ihlali olmasın (ödev kaydı korunur).
    op.execute(
        """
        UPDATE homeworks SET source_custom_tab_section_id = NULL
        WHERE source_custom_tab_section_id IN (
            SELECT id FROM custom_tab_sections
            WHERE custom_tab_id IN (
                SELECT id FROM custom_tabs WHERE label = 'Bildirimler' AND kind IS NULL
            )
        )
        """
    )
    op.execute(
        """
        DELETE FROM custom_tab_sections
        WHERE custom_tab_id IN (
            SELECT id FROM custom_tabs WHERE label = 'Bildirimler' AND kind IS NULL
        )
        """
    )
    op.execute("DELETE FROM custom_tabs WHERE label = 'Bildirimler' AND kind IS NULL")


def downgrade() -> None:
    # Silinen yer tutucu sekme geri getirilmez (içeriği yoktu) — bilinçli no-op.
    pass
