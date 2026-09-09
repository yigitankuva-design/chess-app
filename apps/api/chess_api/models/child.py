from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class ChildProfile(Base):
    __tablename__ = "child_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    age: Mapped[int] = mapped_column(Integer)
    avatar: Mapped[str] = mapped_column(String(40), default="default")
    pin_hash: Mapped[str] = mapped_column(String(255))
    teacher_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    class_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classes.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_active_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Madde 2026-09-07 (GRUP C): Sporcu Profili kimlik kartları — hepsi
    # NULLABLE (mevcut sporcularda boş; KURAL #3). `photo_data_url`:
    # sporcunun yüklediği fotoğraf — bu projede dosya depolama/S3 YOK,
    # istemci tarafında küçültülüp "data:image/...;base64,..." olarak
    # doğrudan bu sütuna yazılıyor (bkz. POST /children/me/photo).
    # `province`: yaşadığı il. Anne/baba ayrı kullanıcı hesabı DEĞİL —
    # sadece görüntülenecek iletişim bilgisi, veli kendi çocuğu için girer
    # (bkz. PATCH /parent/children/{id}/contact-info).
    photo_data_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    province: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    athlete_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    athlete_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    father_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    father_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    father_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mother_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    mother_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    mother_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 1): yeni "Kayıt Ol"
    # formunda sporcunun Lichess kullanıcı adı — User.lichess_username ile
    # AYNI amaç (18+ kendi kaydolan sporcu orada, veli-yönetimli sporcu
    # burada tutulur). NULLABLE — tek isteğe bağlı alan (Zafer'in kuralı).
    lichess_username: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
