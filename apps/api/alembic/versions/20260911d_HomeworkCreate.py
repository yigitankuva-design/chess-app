"""Ödev Sistemi Faz 3: homeworks + homework_recipients

Revision ID: HomeworkF3
Revises: OdevKopruF2

Madde 2026-09-11 (Ödev Sistemi, Faz 3): antrenör bir Alt Konu'yu (lesson_step)
sporcu(lar)a ödev olarak gönderir. Eski `class_assignments` (modül/ders
seviyeli ödev + GRUP D'nin Alt Konu hedeflemesi) TAMAMEN kaldırıldı — kod ve
model gitti. `class_assignments` TABLOSU bilerek DÜŞÜRÜLMEDİ (yıkıcı
migration yok; öksüz tablo zararsız, ileride ayrı bir drop migration'la
temizlenebilir).
"""
import sqlalchemy as sa
from alembic import op

revision = "HomeworkF3"
down_revision = "OdevKopruF2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "homeworks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("lesson_step_id", sa.Integer(), sa.ForeignKey("lesson_steps.id"), nullable=False),
        sa.Column("source_custom_tab_section_id", sa.Integer(),
                  sa.ForeignKey("custom_tab_sections.id"), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_homeworks_teacher_user_id", "homeworks", ["teacher_user_id"])
    op.create_index("ix_homeworks_lesson_step_id", "homeworks", ["lesson_step_id"])

    op.create_table(
        "homework_recipients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("homework_id", sa.Integer(), sa.ForeignKey("homeworks.id"), nullable=False),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=False),
        sa.Column("via_class_id", sa.Integer(), sa.ForeignKey("classes.id"), nullable=True),
        sa.UniqueConstraint("homework_id", "child_id", name="uq_homework_child"),
    )
    op.create_index("ix_homework_recipients_homework_id", "homework_recipients", ["homework_id"])
    op.create_index("ix_homework_recipients_child_id", "homework_recipients", ["child_id"])


def downgrade() -> None:
    op.drop_index("ix_homework_recipients_child_id", table_name="homework_recipients")
    op.drop_index("ix_homework_recipients_homework_id", table_name="homework_recipients")
    op.drop_table("homework_recipients")
    op.drop_index("ix_homeworks_lesson_step_id", table_name="homeworks")
    op.drop_index("ix_homeworks_teacher_user_id", table_name="homeworks")
    op.drop_table("homeworks")
