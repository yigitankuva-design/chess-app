from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Opening(Base):
    """Acilis pratigi icin bir acilis: adi ve baslangic pozisyonu (FEN).

    Icerik Zafer Hoca tarafindan admin panelinden girilir (kullanici verisi).
    """

    __tablename__ = "openings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    start_fen: Mapped[str] = mapped_column(String(120))
    # Sporcuya gosterilen sira (madde 8). Varsayilan 0 -> id sirasina duser,
    # mevcut kayitlarda migration id'yi kopyalar.
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Acilis turu: 'e4' | 'd4' | 'diger'. Eski kayitlar 'diger' olur.
    category: Mapped[str] = mapped_column(
        String(20), default="diger", server_default="diger"
    )
