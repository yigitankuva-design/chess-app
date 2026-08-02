"""games tablosuna student_color sutunu

Revision ID: BotGameColor
Revises: OpeningSortOrder

Yalnizca SUTUN EKLER, nullable. Mevcut satirlar oldugu gibi kalir, devam eden
maclar bozulmaz (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "BotGameColor"
down_revision = "OpeningSortOrder"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("student_color", sa.String(length=1), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "student_color")
