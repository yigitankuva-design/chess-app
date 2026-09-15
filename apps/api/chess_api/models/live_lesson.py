"""Madde 2026-09-15: Online Dersler (canlı ders) — LiveKit self-hosted ile
ses/görüntü, bu iki model ise UYGULAMA tarafındaki dersi (kim, ne zaman,
hangi sınıf, hangi durumda) tutar. `models/module.py`'deki `Lesson`/
`LessonStep` (admin'in yazdığı müfredat içeriği) ile KARIŞTIRILMASIN —
apayrı bir kavram olduğu için isim bilinçli olarak `LiveLesson` seçildi.
"""
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base


class LiveLessonStatus(str, enum.Enum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"


class LiveLessonJoinMode(str, enum.Enum):
    """Antrenörün ders oluştururken seçtiği katılım kuralı — 'auto':
    sporcu isteyince anında kabul edilir, 'approval': antrenör
    onaylamadan LiveKit odasına giremez (bkz. LiveLessonParticipant)."""
    auto = "auto"
    approval = "approval"


class LiveLessonParticipantStatus(str, enum.Enum):
    pending = "pending"
    admitted = "admitted"
    denied = "denied"
    left = "left"


class LiveLesson(Base):
    __tablename__ = "live_lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    coach_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    join_mode: Mapped[LiveLessonJoinMode] = mapped_column(Enum(LiveLessonJoinMode), default=LiveLessonJoinMode.auto)
    status: Mapped[LiveLessonStatus] = mapped_column(Enum(LiveLessonStatus), default=LiveLessonStatus.scheduled)
    # LiveKit oda adı — benzersiz, ders id'sinden türetilir (bkz.
    # services/live_lesson_tokens.py). Odanın kendisi LiveKit sunucusunda
    # yaşar, burada sadece referans tutulur.
    livekit_room_name: Mapped[str] = mapped_column(String(80), unique=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LiveLessonParticipant(Base):
    """Bir sporcunun bir derse katılım durumu. `status='admitted'` bir kez
    olduysa STICKY kalır — bağlantı kopup sporcu tekrar girdiğinde
    (join_mode='approval' olsa bile) yeniden onay istemez, sadece ilk
    giriş onay ister (Zafer'in "istediği zaman çıkıp tekrar girebilir"
    maddesiyle tutarlı — her tekrar girişte antrenörü meşgul etmemek için)."""
    __tablename__ = "live_lesson_participants"
    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("live_lessons.id"), index=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    status: Mapped[LiveLessonParticipantStatus] = mapped_column(
        Enum(LiveLessonParticipantStatus), default=LiveLessonParticipantStatus.pending,
    )
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    admitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
