"""custom_tab_sections.board_exercises kolonu KALDIRILIYOR

Revision ID: SectionBoardExDrop
Revises: SectionPosPool

Madde 2026-08-27 (6): Alt Konu'daki "Kareye Tıkla/Taşa Tıkla/Taşı Oynat"
soru ekleme alanı Zafer hocanın isteğiyle TAMAMEN kaldırıldı. Bu kolon
hiçbir ortamda gerçek veriyle kullanılmadı (yerel Postgres bile ayakta
değildi) — geriye dönük veri taşımaya gerek yok.
"""
import sqlalchemy as sa
from alembic import op

revision = "SectionBoardExDrop"
down_revision = "SectionPosPool"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("custom_tab_sections", "board_exercises")


def downgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("board_exercises", sa.JSON(), nullable=False, server_default="[]"),
    )
