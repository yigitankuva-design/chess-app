"""Üyelik Girişi Yenileme AŞAMA 3: User.birth_date (admin onay ekranı için)

Revision ID: MembershipStage3
Revises: MembershipStage2
Create Date: 2026-09-09

Madde 2026-09-09 (devam): admin "Onay Bekleyenler" ekranında 18+ kendi
kaydolan sporcunun beyan ettiği doğum tarihini görebilmesi için (Tier A —
yaş beyanı riskine karşı asıl önlem: admin makul olup olmadığını
değerlendirir). NULLABLE (KURAL #3) — sadece bu yoldan gelen hesaplarda
dolu.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "MembershipStage3"
down_revision = "MembershipStage2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "birth_date")
