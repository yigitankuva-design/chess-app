"""Görsel Turu Aşama B: profil düzenleme alanları (ülke, nickname)

Revision ID: ProfileEditFields
Revises: TeacherPlayProfile

Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3 + 11):
- child_profiles.country (NULL = Türkiye), .nickname (maçlarda gerçek isim
  yerine görünen ad; benzersizlik uygulama katmanında, büyük/küçük harf
  duyarsız), .nickname_changed_at (3 ayda 1 değişiklik kuralı için).
- users.country — antrenör kendi profilinden ülke düzenler.
- Veri düzeltmesi: Aşama F'de (TeacherPlayProfile) oluşturulan antrenör
  oyun profillerinin `teacher_user_id`'si boştu → antrenör "Arkadaşınla
  Oyna" lobisinde kimseyi görmüyordu. Kendi id'sine bağlanır (lobi
  athletes.py'de `teacher_user_id` eşitliğiyle kurulur).
Hepsi NULLABLE — mevcut kayıtlar bozulmaz (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "ProfileEditFields"
down_revision = "TeacherPlayProfile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("child_profiles", sa.Column("country", sa.String(length=60), nullable=True))
    op.add_column("child_profiles", sa.Column("nickname", sa.String(length=40), nullable=True))
    op.add_column("child_profiles", sa.Column("nickname_changed_at", sa.DateTime(), nullable=True))
    op.create_index("ix_child_profiles_nickname", "child_profiles", ["nickname"])
    op.add_column("users", sa.Column("country", sa.String(length=60), nullable=True))
    op.execute(
        "UPDATE child_profiles SET teacher_user_id = parent_user_id "
        "WHERE teacher_user_id IS NULL AND parent_user_id IN "
        "(SELECT id FROM users WHERE role = 'teacher')"
    )


def downgrade() -> None:
    op.drop_column("users", "country")
    op.drop_index("ix_child_profiles_nickname", table_name="child_profiles")
    op.drop_column("child_profiles", "nickname_changed_at")
    op.drop_column("child_profiles", "nickname")
    op.drop_column("child_profiles", "country")
