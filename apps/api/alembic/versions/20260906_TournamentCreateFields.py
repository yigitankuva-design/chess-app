"""Turnuva Oluştur ekranı: açıklama, başlangıç konumu (FEN), galibiyet ödülü

Revision ID: TournamentCreateFields
Revises: TournamentArena

Madde 2026-09-06: "Turnuva Oluştur" ekranına 3 yeni kart eklendi —
- description: turnuva ile ilgili serbest metin açıklama.
- start_fen: turnuvadaki TÜM eşleşmelerin başlayacağı konum (boş/None =
  standart başlangıç) — tematik turnuva (belirli açılış/varyant) için.
- winning_streak_bonus ("Galibiyet Ödülü"): açıkken 2 galibiyet üst üste
  gelince sonraki sonuç katlanır (mevcut motor davranışı); kapalıyken hep
  düz 2/1/0 puanlanır. Varsayılan True — mevcut turnuvaların davranışı
  değişmez (geriye dönük uyumlu).
"""
import sqlalchemy as sa
from alembic import op

revision = "TournamentCreateFields"
down_revision = "TournamentArena"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tournaments", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("tournaments", sa.Column("start_fen", sa.String(length=100), nullable=True))
    op.add_column(
        "tournaments",
        sa.Column("winning_streak_bonus", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("tournaments", "winning_streak_bonus")
    op.drop_column("tournaments", "start_fen")
    op.drop_column("tournaments", "description")
