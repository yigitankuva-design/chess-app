"""live_lessons + live_lesson_participants tabloları — Online Dersler

Revision ID: LiveLessonsCreate
Revises: GameAnalysisEvalByPly

Madde 2026-09-15: antrenörün planladığı/başlattığı canlı dersler (LiveKit
self-hosted ile ses/görüntü, bu tablo sadece UYGULAMA tarafındaki durumu
tutar) + katılım/onay kayıtları. Ayrıca `notifications.live_lesson_id`
eklenir (homework_id ile AYNI desen — "Online Derse Katıl" hedefi).
"""
import sqlalchemy as sa
from alembic import op

revision = "LiveLessonsCreate"
down_revision = "GameAnalysisEvalByPly"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "live_lessons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coach_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("classes.id"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("join_mode", sa.Enum("auto", "approval", name="livelessonjoinmode"), nullable=False, server_default="auto"),
        sa.Column("status", sa.Enum("scheduled", "live", "ended", name="livelessonstatus"), nullable=False, server_default="scheduled"),
        sa.Column("livekit_room_name", sa.String(80), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("livekit_room_name", name="uq_live_lessons_room_name"),
    )
    op.create_index("ix_live_lessons_coach_user_id", "live_lessons", ["coach_user_id"])
    op.create_index("ix_live_lessons_class_id", "live_lessons", ["class_id"])

    op.create_table(
        "live_lesson_participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("live_lessons.id"), nullable=False),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=False),
        sa.Column("status", sa.Enum("pending", "admitted", "denied", "left", name="livelessonparticipantstatus"), nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("admitted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_live_lesson_participants_lesson_id", "live_lesson_participants", ["lesson_id"])
    op.create_index("ix_live_lesson_participants_child_id", "live_lesson_participants", ["child_id"])

    op.add_column("notifications", sa.Column("live_lesson_id", sa.Integer(), sa.ForeignKey("live_lessons.id"), nullable=True))
    op.create_index("ix_notifications_live_lesson_id", "notifications", ["live_lesson_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_live_lesson_id", table_name="notifications")
    op.drop_column("notifications", "live_lesson_id")

    op.drop_index("ix_live_lesson_participants_child_id", table_name="live_lesson_participants")
    op.drop_index("ix_live_lesson_participants_lesson_id", table_name="live_lesson_participants")
    op.drop_table("live_lesson_participants")

    op.drop_index("ix_live_lessons_class_id", table_name="live_lessons")
    op.drop_index("ix_live_lessons_coach_user_id", table_name="live_lessons")
    op.drop_table("live_lessons")
    sa.Enum(name="livelessonjoinmode").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="livelessonstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="livelessonparticipantstatus").drop(op.get_bind(), checkfirst=True)
