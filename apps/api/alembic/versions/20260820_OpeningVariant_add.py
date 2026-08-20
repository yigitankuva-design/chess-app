"""opening_variants tablosu + openings.start_fen -> variant'a taşınır

Revision ID: OpeningVariant
Revises: PerfRating

"Açılış Pratiği Yap" özelliğine YENİ bir varyant seviyesi eklenir (madde:
2026-08-20): Açılış artık yalnızca İSİM taşır, FEN ayrı bir OpeningVariant
satırında yaşar. Mevcut her açılışın FEN'i KAYBOLMADAN "Ana Hat" adında
otomatik bir varyanta kopyalanır (KURAL #3) — sonra openings.start_fen
kolonu silinir (veri zaten güvenle taşındığı için kayıpsız).
"""
import sqlalchemy as sa
from alembic import op

revision = "OpeningVariant"
down_revision = "PerfRating"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "opening_variants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("opening_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("start_fen", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["opening_id"], ["openings.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_opening_variants_opening_id"), "opening_variants", ["opening_id"], unique=False,
    )

    # Veri tasima: her mevcut acilisin FEN'i "Ana Hat" adiyla tek bir
    # varyanta kopyalanir — sa.table()/insert() KULLANILIR, raw SQL string
    # DEGIL (FEN'ler '/' ve bosluk icerir, quote hatasi riski olurdu).
    conn = op.get_bind()
    openings_tbl = sa.table(
        "openings", sa.column("id", sa.Integer), sa.column("start_fen", sa.String),
    )
    variants_tbl = sa.table(
        "opening_variants",
        sa.column("opening_id", sa.Integer), sa.column("name", sa.String),
        sa.column("start_fen", sa.String), sa.column("sort_order", sa.Integer),
    )
    rows = conn.execute(sa.select(openings_tbl.c.id, openings_tbl.c.start_fen)).fetchall()
    for opening_id, start_fen in rows:
        conn.execute(variants_tbl.insert().values(
            opening_id=opening_id, name="Ana Hat", start_fen=start_fen, sort_order=0,
        ))

    op.drop_column("openings", "start_fen")


def downgrade() -> None:
    op.add_column("openings", sa.Column("start_fen", sa.String(length=120), nullable=True))

    conn = op.get_bind()
    openings_tbl = sa.table(
        "openings", sa.column("id", sa.Integer), sa.column("start_fen", sa.String),
    )
    variants_tbl = sa.table(
        "opening_variants",
        sa.column("id", sa.Integer), sa.column("opening_id", sa.Integer),
        sa.column("start_fen", sa.String),
    )
    rows = conn.execute(
        sa.select(variants_tbl.c.opening_id, variants_tbl.c.start_fen).order_by(variants_tbl.c.id)
    ).fetchall()
    seen: set[int] = set()
    for opening_id, start_fen in rows:
        if opening_id in seen:
            continue  # ilk varyantin FEN'i yeterli — best-effort geri donus
        seen.add(opening_id)
        conn.execute(
            openings_tbl.update().where(openings_tbl.c.id == opening_id).values(start_fen=start_fen)
        )

    op.alter_column("openings", "start_fen", nullable=False)
    op.drop_index(op.f("ix_opening_variants_opening_id"), table_name="opening_variants")
    op.drop_table("opening_variants")
