from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class OpeningType(Base):
    """Acilis TURU (madde: 2026-08-20) — orn. "e4'lü Açılışlar". Eskiden
    kod icinde sabit 3 deger (e4/d4/diger) idi; artik admin'in serbestce
    ekleyip/duzenleyip/sildigi TAM BIR VERI SEVIYESI (Opening ve
    OpeningVariant ile AYNI desen)."""

    __tablename__ = "opening_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Opening(Base):
    """Acilis pratigi icin bir acilis ADI (madde: 2026-08-20 — FEN artik
    burada degil, OpeningVariant'ta). Icerik Zafer Hoca tarafindan admin
    panelinden girilir (kullanici verisi).
    """

    __tablename__ = "openings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    # Sporcuya gosterilen sira (madde 8). Varsayilan 0 -> id sirasina duser,
    # mevcut kayitlarda migration id'yi kopyalar.
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Madde 2026-08-20: eskiden sabit string ('e4'/'d4'/'diger'), artik
    # OpeningType'a FK. Her acilis MUTLAKA bir turun altindadir.
    opening_type_id: Mapped[int] = mapped_column(ForeignKey("opening_types.id"), index=True)


class OpeningVariant(Base):
    """Bir acilisin varyanti: adi + baslangic pozisyonu (FEN) — madde:
    2026-08-20. Bir Opening'in birden fazla varyanti olabilir (orn.
    "İtalyan Açılışı" -> "Klasik Varyant", "Giuoco Piano" vb.)."""

    __tablename__ = "opening_variants"
    id: Mapped[int] = mapped_column(primary_key=True)
    opening_id: Mapped[int] = mapped_column(ForeignKey("openings.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    start_fen: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
