"""game_analyses.eval_by_ply_json — HER ply için ham motor skoru

Revision ID: GameAnalysisEvalByPly
Revises: GameAnalysisCreate

Madde 2026-09-14 (sunucu analiz motoru): motor istemciden backend'e
taşınınca, notasyon kalite işaretleri (?/??/!/!!, bkz.
apps/web/lib/chess/moveQuality.ts) için gereken HER ply'ın (sadece
sporcunun değil, iki tarafın da) ham {cp, mate} skorunu artık backend
saklamalı — önceden bunu istemci motoru anlık üretiyordu.
"""
import sqlalchemy as sa
from alembic import op

revision = "GameAnalysisEvalByPly"
down_revision = "GameAnalysisCreate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "game_analyses",
        sa.Column("eval_by_ply_json", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("game_analyses", "eval_by_ply_json")
