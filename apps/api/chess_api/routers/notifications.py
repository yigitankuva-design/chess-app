"""Ödev Sistemi Faz 4 — sporcu "Bildirimler" sekmesi. Genel amaçlı: tür
(NotificationType) 6 değeri kapsar, ama şu an sadece POST /homework
`odev` türünde satır üretiyor (bkz. chess_api.routers.homework).
"""
from datetime import datetime, timedelta, date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import (
    ChildProfile, Notification, NotificationType, Homework, LessonStep, LiveLesson,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _step_title(step: LessonStep) -> str:
    return (step.content_json or {}).get("title") or f"#{step.id}"


@router.get("")
async def list_notifications(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Bu sporcunun GÖRÜNÜR (visible_from <= bugün) bildirimleri, en yeni
    önce. `unread_count` = "Git"e hiç basılmamış (visited_at IS NULL)
    görünür bildirim sayısı — sekmedeki kırmızı rozet/başlıktaki "N yeni
    bildirim" bundan gelir."""
    today = date_type.today()
    rows = (await db.execute(
        select(Notification).where(
            Notification.child_id == child.id,
            Notification.visible_from <= today,
        ).order_by(Notification.created_at.desc())
    )).scalars().all()

    # type=odev satırları için hedef Alt Konu'yu (lesson_step_id/lesson_id)
    # toplu çözerek "Ödeve Git" linkini kurmaya yetecek veriyi döneriz.
    hw_ids = {n.homework_id for n in rows if n.homework_id is not None}
    homeworks: dict[int, Homework] = {}
    if hw_ids:
        homeworks = {h.id: h for h in (await db.execute(
            select(Homework).where(Homework.id.in_(hw_ids))
        )).scalars().all()}
    step_ids = {h.lesson_step_id for h in homeworks.values()}
    steps: dict[int, LessonStep] = {}
    if step_ids:
        steps = {s.id: s for s in (await db.execute(
            select(LessonStep).where(LessonStep.id.in_(step_ids))
        )).scalars().all()}

    # Madde 2026-09-15 (Online Dersler): type=online_ders satırları için
    # "Online Derse Katıl" linkini kurmaya yetecek veri — odev'in
    # homework_id çözümüyle AYNI desen.
    live_lesson_ids = {n.live_lesson_id for n in rows if n.live_lesson_id is not None}
    live_lessons: dict[int, LiveLesson] = {}
    if live_lesson_ids:
        live_lessons = {l.id: l for l in (await db.execute(
            select(LiveLesson).where(LiveLesson.id.in_(live_lesson_ids))
        )).scalars().all()}

    items = []
    unread = 0
    now = datetime.utcnow()
    for n in rows:
        # Madde 2026-09-17 (madde 1): online_ders bildirimi antrenör derse
        # katılsın ya da katılmasın, dersin PLANLANAN süresi bitene kadar
        # görünür — lesson.status'e DEĞİL scheduled_at+duration_minutes
        # hesabına bakılır. Süre dolunca liste ve unread sayacından düşer.
        if n.type == NotificationType.online_ders and n.live_lesson_id in live_lessons:
            lesson = live_lessons[n.live_lesson_id]
            cutoff = lesson.scheduled_at + timedelta(minutes=lesson.duration_minutes)
            if now > cutoff:
                continue
        if n.visited_at is None:
            unread += 1
        target = None
        if n.type == NotificationType.odev and n.homework_id in homeworks:
            step = steps.get(homeworks[n.homework_id].lesson_step_id)
            if step:
                target = {
                    "lesson_step_id": step.id,
                    "lesson_id": step.lesson_id,
                    "alt_konu_title": _step_title(step),
                }
        elif n.type == NotificationType.online_ders and n.live_lesson_id in live_lessons:
            lesson = live_lessons[n.live_lesson_id]
            target = {"live_lesson_id": lesson.id, "live_lesson_status": lesson.status.value}
        items.append({
            "id": n.id,
            "type": n.type.value,
            "title": n.title,
            "subtitle": n.subtitle,
            "created_at": n.created_at.isoformat(),
            "visited_at": n.visited_at.isoformat() if n.visited_at else None,
            "target": target,
        })
    return {"unread_count": unread, "items": items}


@router.post("/{notification_id}/visit")
async def visit_notification(
    notification_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """"Git" düğmesine basınca çağrılır — tür ne olursa olsun işaretler
    (Zafer: "butona basması yeterli"). Zaten ziyaret edilmişse no-op (idempotent)."""
    n = await db.get(Notification, notification_id)
    if not n or n.child_id != child.id:
        raise HTTPException(404, "Bildirim bulunamadı")
    if n.visited_at is None:
        n.visited_at = datetime.utcnow()
        await db.commit()
        await db.refresh(n)
    return {"id": n.id, "visited_at": n.visited_at.isoformat()}
