"""Ödev Gönder: sınıf ödevi belirli bir Alt Konu'yu (lesson_step) hedefleyebilir

Revision ID: ClassAssignmentLessonStepTarget
Revises: ChildProfileIdentityCards

Madde 2026-09-07 (GRUP D): `class_assignments`e nullable `target_lesson_step_id`
eklendi — Antrenör'ün "Ödev Gönder" ikonundan verdiği ödev artık DERS
İÇİNDEKİ belirli bir Alt Konu'yu hedefleyebilir (mevcut target_module_id/
target_lesson_id davranışı BOZULMADI, bu üçüncü bir seçenek — KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "ClassAssignmentLessonStepTarget"
down_revision = "ChildProfileIdentityCards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "class_assignments",
        sa.Column("target_lesson_step_id", sa.Integer(), sa.ForeignKey("lesson_steps.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("class_assignments", "target_lesson_step_id")
