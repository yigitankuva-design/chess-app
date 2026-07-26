from sqlalchemy import String
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
