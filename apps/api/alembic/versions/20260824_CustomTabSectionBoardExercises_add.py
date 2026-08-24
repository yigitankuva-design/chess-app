"""custom_tab_sections.board_exercises kolonu — Kareye Tıkla/Taşa Tıkla/Taşı Oynat

Revision ID: SectionBoardEx
Revises: SectionParent

Antrenör/Dersler/Düzey/Konu/Alt Konu'da hocanın kendi gösterimi için
kaydettiği tahta soruları (Kareye Tıkla/Taşa Tıkla/Taşı Oynat — madde:
2026-08-24). Derslerdeki (LessonStep.board_exercises) ile AYNI JSON şekli,
ama sporcu tarafından CEVAPLANMAZ — antrenör Hızlı Erişim'de sırayla
öğrencilerine gösterir. Yalnızca YENİ bir kolon eklenir, server_default='[]'
ile — mevcut satırlar etkilenmez (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "SectionBoardEx"
down_revision = "SectionParent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("board_exercises", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "board_exercises")
