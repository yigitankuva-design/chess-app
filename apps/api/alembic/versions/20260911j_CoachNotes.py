"""Görsel Turu Aşama E: hoca notu (coach_notes tablosu + hoca_notu bildirim türü)

Revision ID: CoachNotes
Revises: ProfileEditFields

Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): antrenörün bir sporcunun
profiline yazdığı not — SADECE SON not tutulur (child_id benzersiz, yeni
yazım eskisinin üzerine yazar), silinebilir, ayrı bir "düzenle" ucu yok.
Yazıldığı/değiştirildiği anda sporcuya bir NotificationType.hoca_notu
bildirimi düşer (bkz. routers/teacher.py).

NOT: PostgreSQL bir transaction içinde ENUM'a eklenen YENİ değeri AYNI
transaction içinde KULLANMAYA izin vermiyor (bkz. AdminRole migration'ındaki
AYNI not) — bu migration SADECE şemayı değiştirir, `hoca_notu` değerini
KULLANAN ilk INSERT ancak bir SONRAKİ (ayrı) veritabanı bağlantısında
(uygulama çalışırken) olur, o yüzden burada sorun yok.
"""
import sqlalchemy as sa
from alembic import op

revision = "CoachNotes"
down_revision = "ProfileEditFields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'hoca_notu'")
    op.create_table(
        "coach_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=False, unique=True),
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_coach_notes_child_id", "coach_notes", ["child_id"], unique=True)
    op.create_index("ix_coach_notes_teacher_user_id", "coach_notes", ["teacher_user_id"])


def downgrade() -> None:
    op.drop_index("ix_coach_notes_teacher_user_id", table_name="coach_notes")
    op.drop_index("ix_coach_notes_child_id", table_name="coach_notes")
    op.drop_table("coach_notes")
    # PostgreSQL enum değeri geri alınamaz (downgrade burada no-op).
