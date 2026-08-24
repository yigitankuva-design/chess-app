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
    """Bir ozel sekmenin sayfasindaki tek bir bolum — baslik + yazi + gorseller.
    Pratik Yap sekmesi icin ayrica bir bot-pratigi konum havuzu tutar
    (practice_positions) — {id, fen} sozlukleri; turn FEN icinde zaten var.

    Madde 2026-08-22: `parent_id` ile KENDINE REFERANS veren bir agac yapisi —
    bir alt sekmenin kendi alt sekmeleri, onlarin da kendi alt sekmeleri
    olabilir (sinirsiz derinlik). `custom_tab_id` her seviyede AYNI kok
    sekmeyi gosterir (sorgular basitlesin diye) — parent_id iceride hangi
    dugumun altinda oldugunu belirler. parent_id NULL ise en ust seviye
    (dogrudan sekmenin altindaki) bolumdur."""

    __tablename__ = "custom_tab_sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    custom_tab_id: Mapped[int] = mapped_column(ForeignKey("custom_tabs.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("custom_tab_sections.id"), nullable=True, index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    images: Mapped[list] = mapped_column(JSON, default=list)
    practice_positions: Mapped[list] = mapped_column(JSON, default=list)
    emoji: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Madde 2026-08-24: hocanın kendi gösterimi için kaydettiği tahta soruları
    # (Kareye Tıkla/Taşa Tıkla/Taşı Oynat) — Derslerdeki board_exercises ile
    # AYNI JSON şekli, ama sporcu CEVAPLAMAZ, sadece Antrenör Hızlı Erişim'de
    # sırayla gösterilir.
    board_exercises: Mapped[list] = mapped_column(JSON, default=list)
