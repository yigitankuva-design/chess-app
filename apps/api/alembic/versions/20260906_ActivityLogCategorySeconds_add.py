"""Sporcu Profili "Bu Hafta": Maç Yap/Dersler/Pratik Yap süre ayrımı

Revision ID: ActivityLogCategorySeconds
Revises: PracticePerQuestion

Madde 2026-09-06 (Görsel 4): `child_activity_logs.total_seconds` tek
başına Maç Yap/Dersler/Pratik Yap ayrımı yapamıyordu. 3 yeni sütun
eklendi — `total_seconds` KALDI (geriye uyumluluk, günlük limit kontrolü
hâlâ ona bakıyor).
"""
import sqlalchemy as sa
from alembic import op

revision = "ActivityLogCategorySeconds"
down_revision = "PracticePerQuestion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "child_activity_logs",
        sa.Column("play_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "child_activity_logs",
        sa.Column("lessons_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "child_activity_logs",
        sa.Column("practice_seconds", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("child_activity_logs", "practice_seconds")
    op.drop_column("child_activity_logs", "lessons_seconds")
    op.drop_column("child_activity_logs", "play_seconds")
