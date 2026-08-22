"""fun_activities tablosu (Eğlence sekmesi oyun/yarışma türleri)

Revision ID: FunActivity
Revises: OpeningType

Admin'in Eğlence sekmesi için serbestçe ekleyip/düzenleyip/sildiği oyun/
yarışma türleri — Opening/OpeningType ile AYNI basit desen (isim + sıra),
ek olarak açıklama metni ve ikon (emoji). Yepyeni bir tablo, mevcut veriye
dokunulmaz — veri kaybı riski yok.
"""
import sqlalchemy as sa
from alembic import op

revision = "FunActivity"
down_revision = "OpeningType"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fun_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("emoji", sa.String(length=10), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("fun_activities")
