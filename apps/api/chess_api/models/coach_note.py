from datetime import datetime
from sqlalchemy import Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class CoachNote(Base):
    """Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): antrenörün bir
    sporcunun profiline yazdığı not — sporcu profilinde "Hoca notu"
    kartında görünür, yazıldığı anda sporcuya bir bildirim düşer
    (NotificationType.hoca_notu, bkz. routers/teacher.py).

    S4 (Zafer): SADECE SON not tutulur — bu yüzden `child_id` BENZERSİZ
    (bir sporcunun en fazla 1 satırı olur). Yeni not yazmak ESKİSİNİN
    ÜZERİNE YAZAR (upsert; ayrı bir "düzenle" ucu YOK — Zafer: "düzenlenmez",
    değiştirmek isteyen sil-ve-yeniden-yaz yapar, ki bu zaten aynı çağrı).
    Silinebilir (DELETE) — antrenörün kendi yazdığı notu geri alması için.
    """
    __tablename__ = "coach_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), unique=True, index=True)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow,
    )
