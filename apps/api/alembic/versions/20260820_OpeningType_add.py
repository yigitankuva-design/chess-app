"""opening_types tablosu + openings.category -> opening_type_id FK

Revision ID: OpeningType
Revises: OpeningVariant

"Açılış Türü" (e4/d4/diğer) eskiden KOD İÇİNDE SABİT 3 değerdi (Opening.
category, düz String). Artık admin'in serbestçe ekleyip/düzenleyip/
sildiği TAM BİR VERİ SEVİYESİ (opening_types tablosu, Opening ve
OpeningVariant ile AYNI desen) — madde: 2026-08-20.

Mevcut her açılışın kategorisi KAYBOLMADAN, adı category değerine karşılık
gelen bir OpeningType satırına eşlenir (veri kaybı yok, KURAL #3).

DİKKAT (downgrade): Bu migration'dan SONRA admin YENİ bir açılış türü
eklerse (özelliğin asıl amacı bu), downgrade() o türdeki açılışları
sessizce "diger"e düşürür ve türün adı kalıcı olarak kaybolur — best-effort
bir geri dönüştür. Özellik canlıda KULLANILMAYA BAŞLADIKTAN SONRA bu
downgrade'i ÇALIŞTIRMA (mimari inceleme, 2026-08-20).
"""
import sqlalchemy as sa
from alembic import op

revision = "OpeningType"
down_revision = "OpeningVariant"
branch_labels = None
depends_on = None

_SEED_TYPES = ["e4'lü Açılışlar", "d4'lü Açılışlar", "Diğer Açılışlar"]


def upgrade() -> None:
    op.create_table(
        "opening_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )

    conn = op.get_bind()
    types_tbl = sa.table(
        "opening_types", sa.column("id", sa.Integer),
        sa.column("name", sa.String), sa.column("sort_order", sa.Integer),
    )
    # Tek tek insert edilir (BIRER cagri) — bulk insert'te inserted_primary_key
    # her iki backend'de (SQLite/Postgres) guvenilir donmeyebilir (mimari inceleme).
    e4_id = conn.execute(types_tbl.insert().values(name=_SEED_TYPES[0], sort_order=1)).inserted_primary_key[0]
    d4_id = conn.execute(types_tbl.insert().values(name=_SEED_TYPES[1], sort_order=2)).inserted_primary_key[0]
    other_id = conn.execute(types_tbl.insert().values(name=_SEED_TYPES[2], sort_order=3)).inserted_primary_key[0]

    op.add_column("openings", sa.Column("opening_type_id", sa.Integer(), nullable=True))
    openings_tbl = sa.table(
        "openings", sa.column("id", sa.Integer),
        sa.column("category", sa.String), sa.column("opening_type_id", sa.Integer),
    )
    conn.execute(openings_tbl.update().where(openings_tbl.c.category == "e4").values(opening_type_id=e4_id))
    conn.execute(openings_tbl.update().where(openings_tbl.c.category == "d4").values(opening_type_id=d4_id))
    conn.execute(
        openings_tbl.update()
        .where(sa.or_(openings_tbl.c.category.is_(None), ~openings_tbl.c.category.in_(["e4", "d4"])))
        .values(opening_type_id=other_id)
    )

    op.alter_column("openings", "opening_type_id", nullable=False)
    op.create_index(op.f("ix_openings_opening_type_id"), "openings", ["opening_type_id"], unique=False)
    op.create_foreign_key(
        "fk_openings_opening_type_id", "openings", "opening_types", ["opening_type_id"], ["id"],
    )
    op.drop_column("openings", "category")


def downgrade() -> None:
    op.add_column("openings", sa.Column("category", sa.String(length=20), nullable=True))

    conn = op.get_bind()
    types_tbl = sa.table("opening_types", sa.column("id", sa.Integer), sa.column("name", sa.String))
    openings_tbl = sa.table(
        "openings", sa.column("id", sa.Integer),
        sa.column("opening_type_id", sa.Integer), sa.column("category", sa.String),
    )
    name_to_legacy = {_SEED_TYPES[0]: "e4", _SEED_TYPES[1]: "d4", _SEED_TYPES[2]: "diger"}
    types = conn.execute(sa.select(types_tbl.c.id, types_tbl.c.name)).fetchall()
    for type_id, name in types:
        legacy = name_to_legacy.get(name, "diger")  # bilinmeyen/yeniden adlandirilmis tur -> "diger"
        conn.execute(
            openings_tbl.update().where(openings_tbl.c.opening_type_id == type_id).values(category=legacy)
        )
    conn.execute(
        openings_tbl.update().where(openings_tbl.c.category.is_(None)).values(category="diger")
    )

    op.alter_column("openings", "category", nullable=False, server_default="diger")
    op.drop_constraint("fk_openings_opening_type_id", "openings", type_="foreignkey")
    op.drop_index(op.f("ix_openings_opening_type_id"), table_name="openings")
    op.drop_column("openings", "opening_type_id")
    op.drop_table("opening_types")
