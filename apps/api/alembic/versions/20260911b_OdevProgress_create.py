"""Ödev Sistemi Faz 1: child_odev_progress tablosu

Revision ID: OdevProgressF1
Revises: MembershipStage3

Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" (suresiz mod) artık
başarı EŞİĞİYLE değil, "havuzdaki sabit N sorunun HEPSİ cevaplandı mı" ile
tamamlanır. Sporcu birikimli ilerler ve kaldığı yerden devam eder. Bu tablo
her (çocuk, alt konu) için İLK çözümün birikimli durumunu tutar.

ChildPracticeResult (sureli/test'in "en iyi deneme" mantığı) DEĞİŞMEZ —
bu ayrı bir tablo (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "OdevProgressF1"
down_revision = "MembershipStage3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "child_odev_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=False),
        sa.Column("lesson_step_id", sa.Integer(), sa.ForeignKey("lesson_steps.id"), nullable=False),
        sa.Column("answered_map", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("child_id", "lesson_step_id", name="uq_odev_child_step"),
    )
    op.create_index("ix_child_odev_progress_child_id", "child_odev_progress", ["child_id"])
    op.create_index("ix_child_odev_progress_lesson_step_id", "child_odev_progress", ["lesson_step_id"])


def downgrade() -> None:
    op.drop_index("ix_child_odev_progress_lesson_step_id", table_name="child_odev_progress")
    op.drop_index("ix_child_odev_progress_child_id", table_name="child_odev_progress")
    op.drop_table("child_odev_progress")
