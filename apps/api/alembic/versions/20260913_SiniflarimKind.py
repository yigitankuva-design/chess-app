""""Sınıflarım" özel sekmesini kind='siniflarim' ile işaretle

Revision ID: SiniflarimKind
Revises: CoachNotes

Madde 2026-09-13: antrenörün "Çalışmalar" bölümünde kendi eklediği
"Sınıflarım" özel sekmesi artık ayrı bir sayfaya (`/coach/classes`) gider —
diğer tüm özel sekmeler gibi sayfa içinde açılmak YERİNE. Bu özelliği
sekmenin BAŞLIĞINA (`label`) bakarak tanımlamak kırılgan olurdu (Zafer
"Pratik Yap"ı yeniden adlandırınca AYNI sorun yaşanmıştı — bkz.
DerslerRootKind migration'ındaki not) — bu yüzden `custom_tabs.kind`
alanı (Pratik Yap sekmesiyle AYNI mekanizma, custom_tab.py'deki
`CustomTab.kind` doc-comment'i) kullanılıyor: `kind='siniflarim'` KALICI
bir işarettir, `label` serbestçe değiştirilebilir.

Sadece halihazırda var olan, başlığı "Sınıflarım" ile BAŞLAYAN, henüz
hiçbir kind'i olmayan sekmeyi işaretler.
Böyle bir sekme yoksa (örn. henüz oluşturulmadıysa) bu migration'ın hiçbir
etkisi olmaz — Zafer admin panelinden "Sınıflarım" sekmesini oluşturunca
frontend zaten `kind` alanı boş bir sekmeyi normal (sayfa içi açılan) özel
sekme gibi ele almaya devam eder; gerekirse `kind` admin panelinden
DOĞRUDAN ayarlanamadığı için (Pratik Yap'ta olduğu gibi bilerek PATCH'e
kapalı) ayrı bir tek seferlik migration/script ile işaretlenir.
"""
from alembic import op

revision = "SiniflarimKind"
down_revision = "CoachNotes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE custom_tabs
        SET kind = 'siniflarim'
        WHERE kind IS NULL
          AND label LIKE 'Sınıflarım%'
        """
    )


def downgrade() -> None:
    op.execute(
        "UPDATE custom_tabs SET kind = NULL WHERE kind = 'siniflarim'"
    )
