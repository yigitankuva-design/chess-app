"""Turnuva Oluştur: Turnuva Türü (Arena/İsviçre) ve Berserk

Revision ID: ArenaSwissBerserk
Revises: TournamentOwnerAndLeave

Madde 2026-09-10: turnuva oluşturma ekranına iki yeni seçim eklendi —
- tournament_type: "arena" (mevcut, sürekli/süre-bazlı) veya "swiss"
  (İsviçre usulü — sabit tur sayısı, tur-tur eşleştirme; bu oturumun
  başında Arena'ya geçilirken kaldırılmıştı, ikinci bir MOD olarak geri
  geliyor — bkz. services/swiss.py). Varsayılan "arena" — mevcut tüm
  turnuvalar etkilenmez.
- rounds_total / current_round: SADECE İsviçre'de dolu.
- berserk_enabled: SADECE arena + Yıldırım/Hızlı tempoda anlamlı (kontrol
  routers/live_game.py'de yapılır), varsayılan kapalı.
- tournaments.duration_minutes NULLABLE olur (İsviçre'de anlamsız — bitiş
  tur sayısına bağlı, süreye değil).
- tournament_pairings.round_number: SADECE İsviçre'de dolu.
- tournament_pairings.white_berserked / black_berserked: hangi taraf BU
  maçta berserk yaptı (tekrar berserk'i engellemek + puan bonusu için).
- tournament_participants.bye_count: İsviçre'de kaç kez "bay" (rakipsiz
  otomatik galibiyet) aldı — sıradaki bay'ı verirken bunu hiç almamışlar
  tercih edilsin diye (bay pairing satırı OLUŞTURMADIĞI için başka yerden
  izlenemez).
"""
import sqlalchemy as sa
from alembic import op

revision = "ArenaSwissBerserk"
down_revision = "TournamentOwnerAndLeave"
branch_labels = None
depends_on = None

tournament_type_enum = sa.Enum("arena", "swiss", name="tournamenttype")


def upgrade() -> None:
    tournament_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "tournaments",
        sa.Column("tournament_type", tournament_type_enum, nullable=False, server_default="arena"),
    )
    op.add_column("tournaments", sa.Column("rounds_total", sa.Integer(), nullable=True))
    op.add_column(
        "tournaments",
        sa.Column("current_round", sa.Integer(), nullable=True, server_default="0"),
    )
    op.add_column(
        "tournaments",
        sa.Column("berserk_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.alter_column("tournaments", "duration_minutes", nullable=True)

    op.add_column("tournament_pairings", sa.Column("round_number", sa.Integer(), nullable=True))
    op.add_column(
        "tournament_pairings",
        sa.Column("white_berserked", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "tournament_pairings",
        sa.Column("black_berserked", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "tournament_participants",
        sa.Column("bye_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("tournament_participants", "bye_count")
    op.drop_column("tournament_pairings", "black_berserked")
    op.drop_column("tournament_pairings", "white_berserked")
    op.drop_column("tournament_pairings", "round_number")

    op.execute("UPDATE tournaments SET duration_minutes = 60 WHERE duration_minutes IS NULL")
    op.alter_column("tournaments", "duration_minutes", nullable=False)
    op.drop_column("tournaments", "berserk_enabled")
    op.drop_column("tournaments", "current_round")
    op.drop_column("tournaments", "rounds_total")
    op.drop_column("tournaments", "tournament_type")
    tournament_type_enum.drop(op.get_bind(), checkfirst=True)
