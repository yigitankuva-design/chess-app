"""Pratik Yap: sabit alt bölümlere addan bağımsız kimlik (section_kind)

Revision ID: CustomTabSectionKind
Revises: SwissRoundGap

Madde 2026-09-02: Zafer'in isteğiyle admin artık "Pratik Yap" sekmesinin 3
sabit alt bölümünün (Açılış Pratiği Yap / Kazanç Konumunu Pratik Yap /
Oyunsonu Pratiği Yap) BAŞLIĞINI serbestçe değiştirebiliyor ve silebiliyor.
Bu 3'ünün özel davranışı (açılış pratiği ekranı, 5 kategorili konum seçimi,
"Konumun Sahibi" alanı) eskiden BAŞLIK METNİNE bakarak tanınıyordu — admin
adı değiştirirse davranış sessizce kaybolurdu. `section_kind` bu tanımayı
addan tamamen bağımsız hale getirir: 'opening' | 'kazanc' | 'oyunsonu' |
NULL (sıradan bölüm). BİR KEZ oluşturulunca değişmez, PATCH ile
güncellenemez — yalnızca oluşturma sırasında set edilir.
"""
import sqlalchemy as sa
from alembic import op

revision = "CustomTabSectionKind"
down_revision = "SwissRoundGap"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("section_kind", sa.String(length=20), nullable=True),
    )
    # Geriye dönük veri düzeltmesi: var olan kayıtlarda hâlâ eski başlık
    # eşleşmesi geçerli (henüz kimse yeniden adlandırmadı) — section_kind'ı
    # şimdiki başlıklarına göre BİR KERELİK dolduruyoruz ki mevcut akademiler
    # migration sonrası hiçbir şey kaybetmesin.
    op.execute(
        "UPDATE custom_tab_sections SET section_kind = 'opening' "
        "WHERE title = 'Açılış Pratiği Yap' AND section_kind IS NULL"
    )
    op.execute(
        "UPDATE custom_tab_sections SET section_kind = 'kazanc' "
        "WHERE title = 'Kazanç Konumunu Pratik Yap' AND section_kind IS NULL"
    )
    op.execute(
        "UPDATE custom_tab_sections SET section_kind = 'oyunsonu' "
        "WHERE title = 'Oyunsonu Pratiği Yap' AND section_kind IS NULL"
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "section_kind")
