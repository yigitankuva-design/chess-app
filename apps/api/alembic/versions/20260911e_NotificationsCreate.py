"""Ödev Sistemi Faz 4: notifications tablosu (sporcu "Bildirimler" sekmesi)

Revision ID: NotificationsF4
Revises: HomeworkF3

Madde 2026-09-11 (Ödev Sistemi, Faz 4): genel amaçlı bildirim sistemi —
tip alanı Zafer'in istediği 6 türü (odev/turnuva/online_ders/pratik/mac/
eglence) kapsar; şu an sadece POST /homework bu tabloya `odev` türünde
satır yazıyor, diğerleri ileride kendi üreticilerini alacak.
"""
import sqlalchemy as sa
from alembic import op

revision = "NotificationsF4"
down_revision = "HomeworkF3"
branch_labels = None
depends_on = None

NOTIFICATION_TYPES = ("odev", "turnuva", "online_ders", "pratik", "mac", "eglence")


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=False),
        sa.Column("type", sa.Enum(*NOTIFICATION_TYPES, name="notificationtype"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("subtitle", sa.String(length=200), nullable=True),
        sa.Column("visible_from", sa.Date(), nullable=False),
        sa.Column("visited_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("homework_id", sa.Integer(), sa.ForeignKey("homeworks.id"), nullable=True),
    )
    op.create_index("ix_notifications_child_id", "notifications", ["child_id"])
    op.create_index("ix_notifications_homework_id", "notifications", ["homework_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_homework_id", table_name="notifications")
    op.drop_index("ix_notifications_child_id", table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notificationtype")
