"""Sporcu tarafı — Antrenör'ün "Ödev Gönder" ile verdiği, DERS İÇİNDEKİ
belirli bir Alt Konu'yu (lesson_step) hedefleyen ödevler (madde 2026-09-07,
GRUP D). Modül/ders seviyesindeki eski ödevler (`/teacher/assignments`,
Zafer'in "Hızlı Erişim/Dersler → Ödevlerim" listesi) bu uçla İLGİLİ DEĞİL —
o liste ayrı kalır (KURAL #3).
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, ClassAssignment

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("/my-active-step-ids")
async def my_active_step_ids(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bu sporcuya (sınıfına ya da doğrudan kendisine) Alt Konu bazlı ödev
    verilmiş TÜM lesson_step id'leri — "tamamlandı" durumu BURADA
    tutulmaz (LessonProgressCard zaten skor verisine sahip, oradan
    hesaplanır — veri tekrarı olmasın). LessonProgressCard bu kümedeki
    bir Alt Konu'yu normal zincir kilidini EZEREK açık gösterir."""
    conditions = [ClassAssignment.target_child_id == child.id]
    if child.class_id is not None:
        conditions.append(ClassAssignment.class_id == child.class_id)
    rows = (await db.execute(
        select(ClassAssignment.target_lesson_step_id).where(
            ClassAssignment.target_lesson_step_id.is_not(None),
            or_(*conditions),
        )
    )).scalars().all()
    return {"step_ids": sorted(set(rows))}
