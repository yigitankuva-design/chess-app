"""tournaments / tournament_participants / tournament_pairings tabloları + games.tournament_pairing_id

Revision ID: Tournament
Revises: SectionEmoji

"Turnuvaya Katıl" özelliği (madde: uçtan uca temel akış, İsviçre usulü
basitleştirilmiş eşleştirme). Yalnızca YENİ tablolar + games'e nullable bir
kolon ekler — mevcut hiçbir satır etkilenmez (KURAL #3, #4).

games.tournament_pairing_id ON DELETE SET NULL: child_deletion.py bir maçı
hard-delete ederse ilgili eşleşme satırı "oynanmamış" gibi kalır, patlamaz.
"""
import sqlalchemy as sa
from alembic import op

revision = "Tournament"
down_revision = "SectionEmoji"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tournaments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("rounds_total", sa.Integer(), nullable=False),
        sa.Column("base_ms", sa.Integer(), nullable=True),
        sa.Column("increment_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.Enum("upcoming", "active", "finished", name="tournamentstatus"), nullable=False),
        sa.Column("current_round", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tournaments_created_by_user_id"), "tournaments", ["created_by_user_id"], unique=False)

    op.create_table(
        "tournament_participants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("child_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["child_id"], ["child_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tournament_participants_tournament_id"), "tournament_participants", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_tournament_participants_child_id"), "tournament_participants", ["child_id"], unique=False)

    op.create_table(
        "tournament_pairings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tournament_id", sa.Integer(), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("white_child_id", sa.Integer(), nullable=False),
        sa.Column("black_child_id", sa.Integer(), nullable=True),
        sa.Column("game_id", sa.Integer(), nullable=True),
        sa.Column("result", sa.String(length=10), nullable=True),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["white_child_id"], ["child_profiles.id"]),
        sa.ForeignKeyConstraint(["black_child_id"], ["child_profiles.id"]),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tournament_pairings_tournament_id"), "tournament_pairings", ["tournament_id"], unique=False)
    op.create_index(op.f("ix_tournament_pairings_white_child_id"), "tournament_pairings", ["white_child_id"], unique=False)
    op.create_index(op.f("ix_tournament_pairings_black_child_id"), "tournament_pairings", ["black_child_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_tournament_pairings_black_child_id"), table_name="tournament_pairings")
    op.drop_index(op.f("ix_tournament_pairings_white_child_id"), table_name="tournament_pairings")
    op.drop_index(op.f("ix_tournament_pairings_tournament_id"), table_name="tournament_pairings")
    op.drop_table("tournament_pairings")

    op.drop_index(op.f("ix_tournament_participants_child_id"), table_name="tournament_participants")
    op.drop_index(op.f("ix_tournament_participants_tournament_id"), table_name="tournament_participants")
    op.drop_table("tournament_participants")

    op.drop_index(op.f("ix_tournaments_created_by_user_id"), table_name="tournaments")
    op.drop_table("tournaments")
