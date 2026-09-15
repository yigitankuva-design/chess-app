"""child_aday_hamle_sessions tablosu — Aday Hamle Pratiği sporcu oturumu

Revision ID: AdayHamleSessionCreate
Revises: OnlineDersOlusturSectionKind

Madde 2026-09-16: sporcunun süreli (5/10/15 dk) Aday Hamle Pratiği oturumu —
havuzdan sırayla çözdüğü pozisyonlar + verdiği 3'er hamlelik cevaplar,
"Kontrol Et" ekranında geri izlenebilsin diye kalıcı tutulur. Ödev
sisteminin `ChildOdevProgress`'i buraya uymuyor (o lesson_step'e bağlı, tek
satır, sadece bool tutuyor) — bu yüzden yeni bir tablo.
"""
import sqlalchemy as sa
from alembic import op

revision = "AdayHamleSessionCreate"
down_revision = "OnlineDersOlusturSectionKind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "child_aday_hamle_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("child_profiles.id"), nullable=False),
        sa.Column("section_id", sa.Integer(), sa.ForeignKey("custom_tab_sections.id"), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("pool_snapshot", sa.JSON(), nullable=False),
        sa.Column("current_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("answers", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_child_aday_hamle_sessions_child_id", "child_aday_hamle_sessions", ["child_id"])
    op.create_index("ix_child_aday_hamle_sessions_section_id", "child_aday_hamle_sessions", ["section_id"])


def downgrade() -> None:
    op.drop_index("ix_child_aday_hamle_sessions_section_id", table_name="child_aday_hamle_sessions")
    op.drop_index("ix_child_aday_hamle_sessions_child_id", table_name="child_aday_hamle_sessions")
    op.drop_table("child_aday_hamle_sessions")
