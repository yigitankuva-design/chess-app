"""Antrenör Profili: kimlik fotoğrafı

Revision ID: TeacherProfilePhoto
Revises: AdminAccountAssign

Madde 2026-09-07 (Antrenör Paneli, 4): antrenörün KENDİ Profil sayfasındaki
kimlik alanı artık gerçek fotoğraf yükleyebiliyor — ChildProfile.photo_data_url
ile AYNI desen. NULLABLE — mevcut hesaplarda boş kalır (KURAL #3), boşsa
sabit 🎓 rozeti gösterilmeye devam eder.
"""
import sqlalchemy as sa
from alembic import op

revision = "TeacherProfilePhoto"
down_revision = "AdminAccountAssign"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("photo_data_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "photo_data_url")
