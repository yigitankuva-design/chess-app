"""Remove old seed modules — keep only the 4 level modules

Revision ID: ResetCurriculum3
Revises: ResetCurriculum2
Create Date: 2026-05-29 03:10:00.000000

"""
from alembic import op

revision = 'ResetCurriculum3'
down_revision = 'ResetCurriculum2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Delete all lesson steps and lessons from all modules
    op.execute("DELETE FROM lesson_steps")
    op.execute("DELETE FROM lessons")

    # Remove old modules beyond the 4 levels (added back by old seed script)
    op.execute("DELETE FROM modules WHERE order_index > 4")

    # Ensure the 4 level modules have correct names/icons
    op.execute("""
        UPDATE modules SET
            name = 'Temel Düzey',
            description = 'Satranç tahtası, taşlar ve temel kurallar',
            icon = '🌱'
        WHERE order_index = 1
    """)
    op.execute("""
        UPDATE modules SET
            name = 'Başlangıç Düzeyi',
            description = 'Temel taktikler ve oyun prensipleri',
            icon = '😊'
        WHERE order_index = 2
    """)
    op.execute("""
        UPDATE modules SET
            name = 'Orta Düzey',
            description = 'Açılışlar, pozisyonel oyun ve son oyun',
            icon = '😎'
        WHERE order_index = 3
    """)
    op.execute("""
        UPDATE modules SET
            name = 'İleri Düzey',
            description = 'İleri taktikler, strateji ve turnuva hazırlığı',
            icon = '🔥'
        WHERE order_index = 4
    """)


def downgrade() -> None:
    pass
