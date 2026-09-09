"""Üyelik Girişi Yenileme AŞAMA 2: User'a veli iletişim alanları

Revision ID: MembershipStage2
Revises: MembershipStage1
Create Date: 2026-09-09

Madde 2026-09-09 (devam): 18+ kendi kaydolan sporcunun (User role=athlete)
ChildProfile kaydı YOK — bu yüzden Anne/Baba iletişim bilgileri
ChildProfile'daki AYNI 6 alanın (father_*/mother_*) buradaki karşılığı
olarak users tablosuna eklenir. Hepsi NULLABLE (KURAL #3).
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "MembershipStage2"
down_revision = "MembershipStage1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("father_name", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("father_phone", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("father_email", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("mother_name", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("mother_phone", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("mother_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "mother_email")
    op.drop_column("users", "mother_phone")
    op.drop_column("users", "mother_name")
    op.drop_column("users", "father_email")
    op.drop_column("users", "father_phone")
    op.drop_column("users", "father_name")
