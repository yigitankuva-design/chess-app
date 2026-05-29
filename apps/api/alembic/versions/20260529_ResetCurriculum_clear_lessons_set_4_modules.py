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
    # Bağımlı tabloları CASCADE ile temizle
    op.execute("TRUNCATE TABLE child_lesson_step_results RESTART IDENTITY CASCADE")
    op.execute("TRUNCATE TABLE child_lesson_progress    RESTART IDENTITY CASCADE")
    op.execute("TRUNCATE TABLE lesson_steps              RESTART IDENTITY CASCADE")

    # class_assignments'taki lesson/module FK'larını NULL'a çek
    op.execute("UPDATE class_assignments SET target_lesson_id = NULL, target_module_id = NULL")

    # puzzles'taki module_id FK'sını NULL'a çek
    op.execute("UPDATE puzzles SET module_id = NULL")

    # Dersleri ve modülleri temizle
    op.execute("TRUNCATE TABLE lessons RESTART IDENTITY CASCADE")
    op.execute("TRUNCATE TABLE modules RESTART IDENTITY CASCADE")

    # 4 düzey modülünü yeniden ekle
    op.execute("""
        INSERT INTO modules (order_index, name, description, icon) VALUES
        (1, 'Temel Düzey',       'Satranç tahtası, taşlar ve temel kurallar',              '🌱'),
        (2, 'Başlangıç Düzeyi',  'Temel taktikler ve oyun prensipleri',                    '😊'),
        (3, 'Orta Düzey',        'Açılışlar, pozisyonel oyun ve son oyun',                 '😎'),
        (4, 'İleri Düzey',       'İleri taktikler, strateji ve turnuva hazırlığı',         '🔥')
    """)


def downgrade() -> None:
    # Geri alma desteklenmiyor (içerik kaybı olur)
    pass
