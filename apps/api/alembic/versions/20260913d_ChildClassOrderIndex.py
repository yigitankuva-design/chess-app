""""child_profiles" tablosuna class_order_index ekle (sınıf içi sıralama)

Revision ID: ChildClassOrderIndex
Revises: ClassOrderIndex

Madde 2026-09-13 (Sınıf Listesi yönetimi): antrenör bir sınıftaki
sporcuları ▲/▼ ile sıralayabilsin diye `child_profiles` tablosuna
`class_order_index` eklenir — `Class.order_index` ile AYNI desen, ama
NULLABLE: sadece `class_id` doluyken anlamlı (sınıfsız sporcularda NULL
kalır). Mevcut sınıflı sporcular her sınıfın KENDİ içinde `id` sırasına
göre 0'dan numaralandırılır.
"""
from alembic import op
import sqlalchemy as sa

revision = "ChildClassOrderIndex"
down_revision = "ClassOrderIndex"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("child_profiles", sa.Column("class_order_index", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE child_profiles
        SET class_order_index = numbered.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY class_id ORDER BY id
            ) - 1 AS rn
            FROM child_profiles
            WHERE class_id IS NOT NULL
        ) AS numbered
        WHERE child_profiles.id = numbered.id
        """
    )


def downgrade() -> None:
    op.drop_column("child_profiles", "class_order_index")
