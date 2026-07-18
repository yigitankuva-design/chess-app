from datetime import datetime
from sqlalchemy import DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class AppSettings(Base):
    """Akademi genelinde tek satırlık global ayar (yazılar, tahta, sekmeler).

    data serbest JSON'dur; yeni ayar eklemek migration gerektirmesin diye tek blob tutulur.
    Sporcu app bunu GET /settings ile okur; öğretmen PATCH /admin/settings ile yazar.
    """
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
