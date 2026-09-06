"""Sporcu Profili: Süreli Pratik Yap istatistikleri + Kendini Test Et sınav geçmişi

Revision ID: PracticeAttemptHistory
Revises: ActivityLogCategorySeconds

Madde 2026-09-06 (Görsel 6/7): Zafer'in isteği — "Süreli Pratik Yap" için
günlük/haftalık/aylık/yıllık istatistik, "Kendini Test Et" için her denemenin
ayrı bir "Sınav-N" sekmesi olarak (soru bazlı) görünmesi. `ChildPracticeResult`
sadece EN İYİ denemeyi tutuyor — bu, TÜM deneme GEÇMİŞİNİ tutan yeni bir
tablo. Var olan hiçbir tabloya/satıra dokunulmadı (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "PracticeAttemptHistory"
down_revision = "ActivityLogCategorySeconds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "child_practice_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=False),
        sa.Column("lesson_step_id", sa.Integer(), sa.ForeignKey("lesson_steps.id"), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("per_question_correct", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_child_practice_attempts_child_id", "child_practice_attempts", ["child_id"])
    op.create_index("ix_child_practice_attempts_lesson_step_id", "child_practice_attempts", ["lesson_step_id"])
    op.create_index("ix_child_practice_attempts_created_at", "child_practice_attempts", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_child_practice_attempts_created_at", table_name="child_practice_attempts")
    op.drop_index("ix_child_practice_attempts_lesson_step_id", table_name="child_practice_attempts")
    op.drop_index("ix_child_practice_attempts_child_id", table_name="child_practice_attempts")
    op.drop_table("child_practice_attempts")
