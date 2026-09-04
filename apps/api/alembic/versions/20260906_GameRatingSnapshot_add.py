"""games.white_rating_before/after, black_rating_before/after kolonları

Revision ID: GameRatingSnapshot
Revises: KonumTeoriPools

Madde 2026-09-06 (8): "Maçlarımın Analizi" kartında bir maçın puan farkını
("±N") gösterebilmek için. ChildTempoRating KÜMÜLATİF (her zaman sporcunun
GÜNCEL puanını tutar) — geçmiş bir maça özel o anki değişimi göstermenin tek
yolu bunu maçın kendisine yazmak. 4'ü de NULL varsayılanıyla eklenir; mevcut
kayıtlar (ve puansız/bot maçlar) etkilenmez, apply_rating_update() bunları
SADECE puanlı insan-insan bir maç bitince doldurur (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "GameRatingSnapshot"
down_revision = "KonumTeoriPools"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("games", sa.Column("white_rating_before", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("white_rating_after", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("black_rating_before", sa.Integer(), nullable=True))
    op.add_column("games", sa.Column("black_rating_after", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("games", "black_rating_after")
    op.drop_column("games", "black_rating_before")
    op.drop_column("games", "white_rating_after")
    op.drop_column("games", "white_rating_before")
