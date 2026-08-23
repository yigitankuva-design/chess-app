"""custom_tab_sections.parent_id — iç içe (nested) alt sekmeler

Revision ID: SectionParent
Revises: FunActivity

Admin panelindeki bir özel sekme alt sekmesinin (custom_tab_sections) kendi
alt sekmeleri, onların da kendi alt sekmeleri olabilsin diye (madde:
2026-08-22, "Antrenör" sekmesi/"Sınıflar" ihtiyacı) kendine referans veren
nullable bir `parent_id` eklenir. Mevcut satırlar etkilenmez — hepsi NULL
kalır (yani hepsi en üst seviye bölüm sayılmaya devam eder). Veri kaybı
riski yok.
"""
import sqlalchemy as sa
from alembic import op

revision = "SectionParent"
down_revision = "FunActivity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("parent_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_custom_tab_sections_parent_id"), "custom_tab_sections", ["parent_id"], unique=False,
    )
    op.create_foreign_key(
        "fk_custom_tab_sections_parent_id", "custom_tab_sections", "custom_tab_sections",
        ["parent_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_custom_tab_sections_parent_id", "custom_tab_sections", type_="foreignkey")
    op.drop_index(op.f("ix_custom_tab_sections_parent_id"), table_name="custom_tab_sections")
    op.drop_column("custom_tab_sections", "parent_id")
