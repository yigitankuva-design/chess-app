from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class FunActivity(Base):
    """Eğlence sekmesindeki oyun/yarışma türü (madde: 2026-08-21). Admin
    serbestçe ekler/düzenler/siler; sporcu tarafında dairesel kart olarak
    listelenir. Henüz gerçek oyun mekaniği yok — tıklanınca "hazırlanıyor"
    sayfasına gider (admin'in girdiği isim/açıklamayla)."""

    __tablename__ = "fun_activities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    emoji: Mapped[str] = mapped_column(String(10))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
