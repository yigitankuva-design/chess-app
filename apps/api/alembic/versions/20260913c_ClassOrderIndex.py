""""classes" tablosuna order_index ekle (Sınıflarım sıralama)

Revision ID: ClassOrderIndex
Revises: SiniflarimSectionKind

Madde 2026-09-13 (Sınıflarım yönetimi): antrenör sınıflarını yukarı/aşağı
ok düğmeleriyle sıralayabilsin diye `classes` tablosuna `order_index`
eklenir (CustomTab.order_index ile AYNI desen — oluşturulurken açıkça
atanır). Mevcut satırlar NULL bırakılamaz (model NOT NULL bekliyor) —
önce nullable eklenip her antrenörün kendi sınıfları `created_at` sırasına
göre 0'dan numaralandırılır, sonra NOT NULL yapılır.
"""
from alembic import op
import sqlalchemy as sa

revision = "ClassOrderIndex"
down_revision = "SiniflarimSectionKind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("classes", sa.Column("order_index", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE classes
        SET order_index = numbered.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY teacher_user_id ORDER BY created_at
            ) - 1 AS rn
            FROM classes
        ) AS numbered
        WHERE classes.id = numbered.id
        """
    )
    op.alter_column("classes", "order_index", nullable=False)


def downgrade() -> None:
    op.drop_column("classes", "order_index")
