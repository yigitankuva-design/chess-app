"""Canlı Ders Oluştur sayfası: antrenörün marka logosu

Revision ID: LiveLessonLogo
Revises: CanliDersOlusturRename

Madde 2026-09-17: antrenörün "Canlı Dersler" kartına yükleyebildiği
logo — User.photo_data_url (kişisel kimlik fotoğrafı) ile AYNI desen,
ama AYRI bir alan (kavramsal olarak farklı). NULLABLE — mevcut
hesaplarda boş kalır (KURAL #3), boşsa "Logo Yükle" yer tutucusu
gösterilmeye devam eder.
"""
import sqlalchemy as sa
from alembic import op

revision = "LiveLessonLogo"
down_revision = "CanliDersOlusturRename"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("live_lesson_logo_data_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "live_lesson_logo_data_url")
