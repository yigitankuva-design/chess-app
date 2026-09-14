"""game_analyses tablosu — maç analizi sonuçlarını saklar

Revision ID: GameAnalysisCreate
Revises: ChildClassOrderIndex

Madde 2026-09-14 (3b/4): "Analiz Et" özetini (Kusurlu Hamle/Hata/Vahim
Hata/Ortalama Santipiyon/Doğruluk/Açılış-Oyunortası-Oyunsonu) ve hatalı
hamlelerin listesini (madde 3c'nin "Hatalarını Gözden Geçir" pratiği için)
saklayan yeni tablo. Motor hâlâ istemcide (tarayıcıda) çalışıyor — backend'e
stockfish eklenmedi, sadece SONUÇ saklanıyor.
"""
import sqlalchemy as sa
from alembic import op

revision = "GameAnalysisCreate"
down_revision = "ChildClassOrderIndex"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "game_analyses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("game_id", sa.Integer(), sa.ForeignKey("games.id"), nullable=False),
        sa.Column("inaccuracies", sa.Integer(), nullable=False),
        sa.Column("mistakes", sa.Integer(), nullable=False),
        sa.Column("blunders", sa.Integer(), nullable=False),
        sa.Column("acpl", sa.Integer(), nullable=True),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("phase_accuracy_opening", sa.Float(), nullable=True),
        sa.Column("phase_accuracy_middlegame", sa.Float(), nullable=True),
        sa.Column("phase_accuracy_endgame", sa.Float(), nullable=True),
        sa.Column("mistake_moves_json", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("game_id", name="uq_game_analyses_game_id"),
    )
    op.create_index("ix_game_analyses_game_id", "game_analyses", ["game_id"])


def downgrade() -> None:
    op.drop_index("ix_game_analyses_game_id", table_name="game_analyses")
    op.drop_table("game_analyses")
