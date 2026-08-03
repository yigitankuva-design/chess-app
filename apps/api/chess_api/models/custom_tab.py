from sqlalchemy import String, Integer, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class CustomTab(Base):
    """Zafer hoca'nin ekledigi ozel sekme — kendi sayfasi olan sinirsiz-sayida
    sekme (B grubu). Eski "hazir sayfaya kisayol" ozelliginin yerine gecer."""

    __tablename__ = "custom_tabs"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(60))
    emoji: Mapped[str] = mapped_column(String(10))


class CustomTabSection(Base):
    """Bir ozel sekmenin sayfasindaki tek bir bolum — baslik + yazi + gorseller."""

    __tablename__ = "custom_tab_sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    custom_tab_id: Mapped[int] = mapped_column(ForeignKey("custom_tabs.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    images: Mapped[list] = mapped_column(JSON, default=list)
