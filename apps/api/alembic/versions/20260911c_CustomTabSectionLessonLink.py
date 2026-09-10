"""Ödev Sistemi Faz 2: custom_tab_sections.linked_lesson_step_id (müfredat köprüsü)

Revision ID: OdevKopruF2
Revises: OdevProgressF1

Madde 2026-09-11 (Ödev Sistemi, Faz 2): Antrenör "Çalışmalar/Dersler"
ağacında bir Alt Konu anlatırken "Ödev Gönder"e basınca, ödev olarak GİDEN
şey o Alt Konu'nun Dersler MÜFREDATINDAKİ karşılığıdır (bir LessonStep).
Bu köprü şimdiye kadar YOKTU. Bu sütun onu KALICI bir ID ile kurar —
başlık sonradan değişse bile bağ kırılmaz (Zafer'in isteği).

Sütun NULLABLE başlar; admin panelinden "Otomatik Eşleştir" düğmesiyle
başlık eşleşmesinden BİR KERELİK doldurulur (bkz. POST
/admin/custom-tabs/lesson-link/auto-match) ya da her Alt Konu için elle
seçilir. NULL kaldığı sürece o Alt Konu'nun "Ödev Gönder" düğmesi devre
dışıdır ("bu alt konu müfredata bağlı değil").
"""
import sqlalchemy as sa
from alembic import op

revision = "OdevKopruF2"
down_revision = "OdevProgressF1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("linked_lesson_step_id", sa.Integer(),
                  sa.ForeignKey("lesson_steps.id"), nullable=True),
    )
    op.create_index(
        "ix_custom_tab_sections_linked_lesson_step_id",
        "custom_tab_sections", ["linked_lesson_step_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_custom_tab_sections_linked_lesson_step_id",
        table_name="custom_tab_sections",
    )
    op.drop_column("custom_tab_sections", "linked_lesson_step_id")
