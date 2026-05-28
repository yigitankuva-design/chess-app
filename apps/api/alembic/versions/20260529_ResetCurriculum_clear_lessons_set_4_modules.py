"""Clear all lessons and set 4 level modules

Revision ID: ResetCurriculum
Revises: AthleteRole
Create Date: 2026-05-29 01:00:00.000000

"""
from alembic import op

revision = 'ResetCurriculum'
down_revision = 'AthleteRole'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Bağımlı tabloları temizle
    op.execute("DELETE FROM lesson_steps")
    op.execute("DELETE FROM lessons")
    op.execute("DELETE FROM modules")

    # 4 düzey modülünü ekle
    op.execute("""
        INSERT INTO modules (order_index, name, description, icon) VALUES
        (1, 'Temel Düzey',       'Satranç tahtası, taşlar ve temel kurallar',          '🌱'),
        (2, 'Başlangıç Düzeyi',  'Temel taktikler ve oyun prensipleri',                '😊'),
        (3, 'Orta Düzey',        'Açılışlar, pozisyonel oyun ve son oyun',             '😎'),
        (4, 'İleri Düzey',       'İleri taktikler, strateji ve turnuva hazırlığı',     '🔥')
    """)


def downgrade() -> None:
    # Geri alma desteklenmiyor (içerik kaybı olur)
    pass
