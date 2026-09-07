""""Dersler" kök bölümünü section_kind='dersler_root' ile işaretle

Revision ID: DerslerRootKind
Revises: TeacherProfilePhoto

Madde 2026-09-08: "Çalışmalar" (eski adıyla "Antrenör") sekmesindeki
"Dersler" kök bölümünün Alt Konu/konum-havuzu özelliği, bölümün BAŞLIĞININ
tam olarak "Dersler" olmasına bağlı sabit bir kontrolle çalışıyordu (bkz.
NestedSectionTree.tsx/NestedSectionAccordion.tsx DERSLER_TITLE). Zafer bu
bölümü "Dersler (Konu Anlatımı ve Ödevlendirme)" olarak yeniden
adlandırınca özellik kayboldu — bu migration, halihazırda var olan kök
bölümü section_kind='dersler_root' ile İŞARETLER; kod artık başlığa değil
bu kalıcı işarete bakıyor (aynı desen: section_kind='opening'/'kazanc'/
'oyunsonu' — Pratik Yap'ın sabit bölümleri). Böylece bölüm adı SERBESTÇE
değiştirilebilir, özellik bozulmaz.

Sadece kök seviyedeki (parent_id IS NULL), başlığı "Dersler" ile
BAŞLAYAN, henüz hiçbir section_kind'i olmayan bölümleri işaretler — bu
projede (tek yönetici, tek böyle bir kök) bu eşleşme tektir.
"""
from alembic import op

revision = "DerslerRootKind"
down_revision = "TeacherProfilePhoto"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE custom_tab_sections
        SET section_kind = 'dersler_root'
        WHERE parent_id IS NULL
          AND section_kind IS NULL
          AND title LIKE 'Dersler%'
        """
    )


def downgrade() -> None:
    op.execute(
        "UPDATE custom_tab_sections SET section_kind = NULL WHERE section_kind = 'dersler_root'"
    )
