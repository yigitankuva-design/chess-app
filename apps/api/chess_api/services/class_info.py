"""Madde 2026-09-13 (Sınıflarım — Madde 3): sporcunun profilindeki "Sınıf
Bilgileri" kartı için veri — hem sporcunun kendi `/gamification/me`
görünümü hem antrenörün `/teacher/students/{id}/profile-summary` salt-okunur
görünümü AYNI şekli döner (bkz. routers/gamification.py::_compute_progress,
coach_notes.py ile AYNI desen).
"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import ChildProfile, Class, User


async def get_class_info_payload(db: AsyncSession, child: ChildProfile) -> dict | None:
    """Sporcu henüz bir sınıfa katılmadıysa (class_id None) None döner —
    frontend bunu "Sınıfa Katıl" butonunun gösterileceği boş durum olarak
    yorumlar."""
    if child.class_id is None:
        return None
    cls = await db.get(Class, child.class_id)
    if cls is None:
        return None
    teacher = await db.get(User, cls.teacher_user_id)
    student_count = await db.scalar(
        select(func.count(ChildProfile.id)).where(ChildProfile.class_id == cls.id)
    )
    return {
        "class_name": cls.name,
        "teacher_name": teacher.name if teacher else None,
        "student_count": student_count or 0,
    }
