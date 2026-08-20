from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ChildTempoRating(Base):
    """Sporcunun bir tempo turundeki (Yıldırım/Hızlı/Klasik) Performans Puanı.

    Her sporcu-tempo ikilisi icin AYRI bir satir — puan/unvan tempo turleri
    arasinda BAGIMSIZDIR (madde: 2026-08-20). Satir yoksa sporcu o tempoda
    hic derecelendirilen mac oynamamis demektir (get_or_create ile ilk
    puanlanan mactan hemen once olusturulur, katilimda DEGIL)."""
    __tablename__ = "child_tempo_ratings"
    __table_args__ = (UniqueConstraint("child_id", "tempo", name="uq_child_tempo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    tempo: Mapped[str] = mapped_column(String(10))
    rating: Mapped[int] = mapped_column(Integer, default=400)
    games_played: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
