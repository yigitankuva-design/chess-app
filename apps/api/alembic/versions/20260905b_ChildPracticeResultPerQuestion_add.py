"""Sporcu Profili "Ödevlerim": soru bazlı doğru/yanlış dizisi

Revision ID: PracticePerQuestion
Revises: ClassAssignmentTargets

Madde 2026-09-05: Sporcu Profili sayfasındaki "Ödevlerim" paneli, bir alt
konu + modun (şimdilik sadece "Ödevini Yap") soru sayısı kadar yeşil/kırmızı
kare gösterecek — HANGİ sorunun doğru/yanlış olduğunu göstermek için.
`child_practice_results`'a EN İYİ denemenin soru sırasına göre doğru/yanlış
listesini tutan bir sütun eklenir (best_correct/best_total ile AYNI
denemeye ait — ayrı bir "tüm zamanların havuz-geneli" takip değildir).
"""
import sqlalchemy as sa
from alembic import op

revision = "PracticePerQuestion"
down_revision = "ClassAssignmentTargets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "child_practice_results",
        sa.Column("per_question_correct", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("child_practice_results", "per_question_correct")
