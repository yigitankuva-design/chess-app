from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class Class(Base):
    __tablename__ = "classes"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    join_code: Mapped[str] = mapped_column(String(8), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# Madde 2026-09-11 (Ödev Sistemi Faz 3): eski `ClassAssignment` (modül/ders
# seviyeli ödev + GRUP D'nin Alt Konu hedeflemesi) TAMAMEN KALDIRILDI —
# yerine `chess_api.models.homework.Homework` geçti (sadece Alt Konu
# üzerinden çalışır). `class_assignments` tablosu DB'de öksüz kalır (yıkıcı
# migration yazılmadı); ileride ayrı bir drop migration'la temizlenebilir.
