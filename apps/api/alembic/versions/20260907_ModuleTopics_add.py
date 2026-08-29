"""Düzey başlığının 3. satırı: modules.topics (konu özeti)

Revision ID: ModuleTopics
Revises: TournamentCreateFields

Madde 2026-09-07 (2): Hızlı Erişim > Dersler düzey başlıkları artık 3
satır — isim / (açıklama) / konular. "Konular" admin'den girilir,
description ile AYNI opsiyonel-boş desen (nullable, varsayılan None).
"""
import sqlalchemy as sa
from alembic import op

revision = "ModuleTopics"
down_revision = "TournamentCreateFields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("modules", sa.Column("topics", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("modules", "topics")
