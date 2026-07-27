"""games tablosuna mac saati sutunlari

Revision ID: GameClock
Revises: PoolImages

Yalnizca SUTUN EKLER. Hepsi nullable oldugu icin mevcut satirlar oldugu gibi
kalir ve devam eden maclar bozulmaz (KURAL #3). Mufredat tablolarina
dokunulmaz (KURAL #4). TRUNCATE/DELETE yoktur.
"""
import sqlalchemy as sa
from alembic import op

revision = "GameClock"
down_revision = "PoolImages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("base_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("increment_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("white_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("black_ms", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("last_clock_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "last_clock_at")
    op.drop_column("games", "black_ms")
    op.drop_column("games", "white_ms")
    op.drop_column("games", "increment_ms")
    op.drop_column("games", "base_ms")
