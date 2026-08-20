"""child_tempo_ratings tablosu + games.rated / tournaments.rated kolonları

Revision ID: PerfRating
Revises: Tournament

"Sporcu Performans Puanı" (madde: 2026-08-20) — her tempo türü için AYRI
Elo benzeri puan. Yalnızca YENİ tablo + iki nullable-olmayan ama
server_default'lu bool kolon ekler — mevcut hiçbir satır etkilenmez
(KURAL #3, #4).
"""
import sqlalchemy as sa
from alembic import op

revision = "PerfRating"
down_revision = "Tournament"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "child_tempo_ratings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=False),
        sa.Column("tempo", sa.String(length=10), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("games_played", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["child_id"], ["child_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("child_id", "tempo", name="uq_child_tempo"),
    )
    op.create_index(op.f("ix_child_tempo_ratings_child_id"), "child_tempo_ratings", ["child_id"], unique=False)

    op.add_column("games", sa.Column("rated", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tournaments", sa.Column("rated", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("tournaments", "rated")
    op.drop_column("games", "rated")

    op.drop_index(op.f("ix_child_tempo_ratings_child_id"), table_name="child_tempo_ratings")
    op.drop_table("child_tempo_ratings")
