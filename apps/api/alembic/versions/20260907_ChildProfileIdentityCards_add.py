"""Sporcu Profili kimlik kartları: fotoğraf + il + İletişim Bilgileri

Revision ID: ChildProfileIdentityCards
Revises: PracticeAttemptHistory

Madde 2026-09-07 (GRUP C): kimlik şeridi 3 karta bölünüyor — fotoğraf
yükleme, ülke+il+üyelik tarihi, İletişim Bilgileri (Sporcu/Baba/Anne).
Hepsi NULLABLE — mevcut sporcularda boş kalır (KURAL #3), veli sonradan
doldurur (bkz. PATCH /parent/children/{id}/contact-info).
"""
import sqlalchemy as sa
from alembic import op

revision = "ChildProfileIdentityCards"
down_revision = "PracticeAttemptHistory"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("child_profiles", sa.Column("photo_data_url", sa.Text(), nullable=True))
    op.add_column("child_profiles", sa.Column("province", sa.String(length=60), nullable=True))
    op.add_column("child_profiles", sa.Column("athlete_phone", sa.String(length=30), nullable=True))
    op.add_column("child_profiles", sa.Column("athlete_email", sa.String(length=255), nullable=True))
    op.add_column("child_profiles", sa.Column("father_name", sa.String(length=80), nullable=True))
    op.add_column("child_profiles", sa.Column("father_phone", sa.String(length=30), nullable=True))
    op.add_column("child_profiles", sa.Column("father_email", sa.String(length=255), nullable=True))
    op.add_column("child_profiles", sa.Column("mother_name", sa.String(length=80), nullable=True))
    op.add_column("child_profiles", sa.Column("mother_phone", sa.String(length=30), nullable=True))
    op.add_column("child_profiles", sa.Column("mother_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("child_profiles", "mother_email")
    op.drop_column("child_profiles", "mother_phone")
    op.drop_column("child_profiles", "mother_name")
    op.drop_column("child_profiles", "father_email")
    op.drop_column("child_profiles", "father_phone")
    op.drop_column("child_profiles", "father_name")
    op.drop_column("child_profiles", "athlete_email")
    op.drop_column("child_profiles", "athlete_phone")
    op.drop_column("child_profiles", "province")
    op.drop_column("child_profiles", "photo_data_url")
