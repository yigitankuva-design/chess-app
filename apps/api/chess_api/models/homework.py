from datetime import datetime, date
from sqlalchemy import String, Text, ForeignKey, DateTime, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Homework(Base):
    """Madde 2026-09-11 (Ödev Sistemi Faz 3): antrenörün bir Alt Konu'yu
    (lesson_step) sporcu(lar)a ödev olarak göndermesi.

    - `lesson_step_id` — ödevin hedefi olan Alt Konu (antrenör "Çalışmalar/
      Dersler" ağacında hangi Alt Konu'yu anlatıyorsa onun müfredat
      karşılığı, bkz. custom_tab_sections.linked_lesson_step_id — Faz 2).
    - Alıcılar `homework_recipients`'ta TEK TEK tutulur ("Tüm Sınıf"
      seçilirse gönderim anında o sınıfın MEVCUT öğrencilerine açılır;
      sonradan sınıf değişse bile ödev alıcıları sabit kalır).
    - `start_date` — ödevin sporcunun "Bildirimler" sekmesine DÜŞECEĞİ
      tarih (o tarihten önce sporcuya görünmez — Faz 4).
    - `end_date` — son teslim tarihi; YUMUŞAK (geçse de "Ödevini Yap"
      düğmesi yeşil kalır, sporcu ödevini yapabilir — Zafer'in isteği,
      geç ödev takibi ayrı iş).

    Eski `ClassAssignment` (modül/ders seviyeli ödev) Faz 3'te tamamen
    kaldırıldı — bu onun yerine geçer, sadece Alt Konu üzerinden çalışır.
    """
    __tablename__ = "homeworks"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    # İzlenebilirlik: antrenör hangi "Çalışmalar/Dersler" Alt Konu düğümünü
    # anlatırken gönderdi (opsiyonel — doğrudan API'den de gönderilebilir).
    source_custom_tab_section_id: Mapped[int | None] = mapped_column(
        ForeignKey("custom_tab_sections.id"), nullable=True,
    )
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HomeworkRecipient(Base):
    """Bir ödevin tek bir alıcı sporcusu. `via_class_id` — gönderim anında
    "Tüm Sınıf" ile mi eklendi (bilgi amaçlı; NULL = tek tek seçildi)."""
    __tablename__ = "homework_recipients"
    __table_args__ = (
        UniqueConstraint("homework_id", "child_id", name="uq_homework_child"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    homework_id: Mapped[int] = mapped_column(ForeignKey("homeworks.id"), index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    via_class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id"), nullable=True)
