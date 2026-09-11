import enum
from datetime import datetime, date
from sqlalchemy import String, ForeignKey, DateTime, Date, Enum
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class NotificationType(str, enum.Enum):
    """Madde 2026-09-11 (Ödev Sistemi Faz 4): "Bildirimler" sekmesi GENEL
    AMAÇLIDIR — Zafer'in isteğiyle 6 tür tanımlı. Şu an sadece `odev` için
    gerçek bir üretici (POST /homework) var; diğerleri (turnuva/online_ders/
    pratik/mac/eglence) ileride kendi tetikleyicilerini alacak — tip zaten
    hazır, sadece kimse şu an bu satırları oluşturmuyor.

    Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): `hoca_notu` eklendi —
    antrenör bir sporcunun profiline not yazınca/değiştirince üretilir
    (bkz. routers/teacher.py, models/coach_note.py)."""
    odev = "odev"
    turnuva = "turnuva"
    online_ders = "online_ders"
    pratik = "pratik"
    mac = "mac"
    eglence = "eglence"
    hoca_notu = "hoca_notu"


class Notification(Base):
    """Bir sporcuya düşen tek bir bildirim satırı. `title`/`subtitle`
    OLUŞTURULDUĞU ANDA sabitlenir (snapshot) — ilgili Alt Konu/ders adı
    sonradan değişse bile bildirim metni bozulmaz.

    `visible_from` — bu tarihten ÖNCE sporcuya HİÇ gösterilmez (Zafer:
    "başlangıç tarihi ödevin bildirim sekmesine düşeceği tarih"); `odev`
    türünde bu, Homework.start_date'in aynısıdır.

    `visited_at` — NULL: "Git" düğmesi YEŞİL (henüz gidilmedi); dolu: KIRMIZI
    (gidildi). "Git"e her basışta (tür ne olursa olsun) işaretlenir.

    `homework_id` — SADECE type=odev'de dolu; "Ödeve Git" için hedef Alt
    Konu'yu (Homework.lesson_step_id üzerinden) çözmeye yarar.
    """
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType))
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[str | None] = mapped_column(String(200), nullable=True)
    visible_from: Mapped[date] = mapped_column(Date)
    visited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    homework_id: Mapped[int | None] = mapped_column(ForeignKey("homeworks.id"), nullable=True, index=True)
