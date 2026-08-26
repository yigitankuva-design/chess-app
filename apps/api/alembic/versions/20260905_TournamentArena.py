"""Turnuvalar: sabit tur (İsviçre) modelinden Lichess Arena moduna geçiş

Revision ID: TournamentArena
Revises: SectionBoardExDrop

Madde 2026-09-05: turnuvalar artık sabit TUR SAYISI değil sabit bir SÜRE
boyunca çalışıyor (Lichess Arena), sporcular maç bitince anında en yakın
puanlı rakiple yeniden eşleşiyor (round kavramı yok). Bu yüzden:
- tournaments: rounds_total/current_round KALKAR; starts_at/duration_minutes
  eklenir (mevcut satırlar started_at/created_at'ten backfill edilir, yoksa
  60 dakika varsayılan süre verilir — geriye dönük veri kaybı yok, sadece
  round kavramı anlamsızlaşıyor).
- tournament_participants: current_streak eklenir (seri puan katlaması için).
- tournament_pairings: round_number KALKAR — kronolojik sıra zaten artan
  `id` ile korunuyor, ayrı bir alana gerek yok. Ayrıca Arena'da bay geçme
  KAVRAMI yok (kuyrukta yalnız kalan rakip gelene kadar bekler) — bu yüzden
  black_child_id artık NOT NULL; geçmişteki bay geçme satırları (black_child_id
  NULL) silinir (yeni modelde karşılığı yok, skorlarını zaten aldılar).
"""
import sqlalchemy as sa
from alembic import op

revision = "TournamentArena"
down_revision = "SectionBoardExDrop"
branch_labels = None
depends_on = None

DEFAULT_DURATION_MINUTES = 60


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("starts_at", sa.DateTime(), nullable=True))
    op.add_column("tournaments", sa.Column("duration_minutes", sa.Integer(), nullable=True))

    # Mevcut satırları backfill et: starts_at = started_at ya da created_at.
    op.execute(
        "UPDATE tournaments SET starts_at = COALESCE(started_at, created_at) "
        "WHERE starts_at IS NULL"
    )
    op.execute(
        f"UPDATE tournaments SET duration_minutes = {DEFAULT_DURATION_MINUTES} "
        "WHERE duration_minutes IS NULL"
    )

    op.alter_column("tournaments", "starts_at", nullable=False)
    op.alter_column("tournaments", "duration_minutes", nullable=False)

    op.drop_column("tournaments", "rounds_total")
    op.drop_column("tournaments", "current_round")

    op.add_column(
        "tournament_participants",
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
    )

    op.drop_column("tournament_pairings", "round_number")

    # Arena'da bay gecme yok — eski bay satirlarini (rakipsiz) sil, sonra
    # black_child_id'yi NOT NULL yap.
    op.execute("DELETE FROM tournament_pairings WHERE black_child_id IS NULL")
    op.alter_column("tournament_pairings", "black_child_id", nullable=False)


def downgrade() -> None:
    op.alter_column("tournament_pairings", "black_child_id", nullable=True)
    op.add_column(
        "tournament_pairings",
        sa.Column("round_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.drop_column("tournament_participants", "current_streak")
    op.add_column("tournaments", sa.Column("current_round", sa.Integer(), nullable=True))
    op.add_column(
        "tournaments",
        sa.Column("rounds_total", sa.Integer(), nullable=False, server_default="4"),
    )
    op.drop_column("tournaments", "duration_minutes")
    op.drop_column("tournaments", "starts_at")
