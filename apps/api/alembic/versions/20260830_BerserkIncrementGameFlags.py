"""Berserk artırım iptali + İsviçre geç katılım bayrağı

Revision ID: BerserkIncrementGameFlags
Revises: ArenaSwissBerserk

Madde 2026-09-XX ("İsviçre puanlama"/Berserk raporu düzeltmeleri):

1. Berserk artık SADECE kendi saatini yarıya indirmiyor, artırımı da
   SIFIRLIYOR (Lichess'in gerçek kuralı — Zafer'in kararı). Artırım hesabı
   games.increment_ms'den TEK bir paylaşılan değer okuyordu
   (services/clock.py::ClockState); hangi tarafın artırım ALMAYACAĞINI
   bilmesi için bu bayrağın game satırında da (SADECE tournament_pairings'te
   değil) bulunması gerekiyor — clock mantığı (routers/live_game.py::
   _clock_state/_apply_clock_on_move) her hamlede TournamentPairing'e JOIN
   atmadan, doğrudan Game'den okusun diye. tournament_pairings.white_
   berserked/black_berserked DOKUNULMADI — onlar hâlâ puanlama bonusu için
   kullanılıyor (bilinçli küçük bir tekrar, riski azaltmak için tercih
   edildi — mevcut puanlama testlerine dokunmadan sadece saat tarafına EK
   yapıldı).

2. İsviçre'de geç katılım yeniden açıldı (bay puanlaması: eşleşme
   bulunamayana 1.0, sonradan katılana 0.5 — rapordaki 6. öneri). "Sonradan
   katılan" mı diye anlamak için ZAMAN DAMGASI KARŞILAŞTIRMASI YERİNE
   (tournaments.started_at NOMİNAL starts_at'i tutuyor, GERÇEK 1. tur
   üretim anını değil — turnuva geç lazy-tetiklenirse bu karşılaştırma
   yanlış pozitif üretirdi) katılma ANINDAKİ turnuva durumuna bakan bir
   bayrak (tournament_participants.late_joiner) eklendi — routers/
   tournaments.py::join_tournament, o an t.status upcoming DEĞİLSE (1. tur
   zaten üretilmiş demektir) True yazar.
"""
import sqlalchemy as sa
from alembic import op

revision = "BerserkIncrementGameFlags"
down_revision = "ArenaSwissBerserk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "games",
        sa.Column("white_berserked", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "games",
        sa.Column("black_berserked", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "tournament_participants",
        sa.Column("late_joiner", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("tournament_participants", "late_joiner")
    op.drop_column("games", "black_berserked")
    op.drop_column("games", "white_berserked")
