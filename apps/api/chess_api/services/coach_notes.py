"""Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): antrenörün bir
sporcunun profiline yazdığı not. Yazma/silme routers/teacher.py'de
(sadece antrenör, `_get_child_for_teacher` izin deseniyle); OKUMA burada
TEK bir paylaşılan fonksiyondan — hem sporcunun kendi `/gamification/me`
görünümü hem antrenörün `/teacher/students/{id}/profile-summary` salt-okunur
görünümü AYNI şekli döner (bkz. routers/gamification.py::_compute_progress).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import CoachNote, User


async def get_coach_note_payload(db: AsyncSession, child_id: int) -> dict | None:
    """Bu sporcunun (varsa) TEK notu — {text, teacher_name, created_at}.
    Not yoksa None (sporcu/antrenör tarafı bunu "henüz not yok" placeholder'ı
    olarak yorumlar)."""
    row = (await db.execute(
        select(CoachNote, User)
        .join(User, User.id == CoachNote.teacher_user_id)
        .where(CoachNote.child_id == child_id)
    )).first()
    if row is None:
        return None
    note, teacher = row
    return {
        "text": note.text,
        "teacher_name": teacher.name,
        "created_at": note.created_at.isoformat(),
    }
