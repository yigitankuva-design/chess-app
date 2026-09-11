"""Ödev Sistemi Faz 3 — antrenör bir Alt Konu'yu (lesson_step) sporcu(lar)a
ödev olarak gönderir. Eski `class_assignments` (modül/ders seviyeli ödev +
GRUP D) tamamen kaldırıldı; bu onun yerine geçer, SADECE Alt Konu üzerinden.

Sporcu tarafı ("Bildirimler" sekmesi, "Ödeve Git") Faz 4'te chess_api.
routers.notifications'a eklendi — bu router antrenör uçlarını içerir
(gönderme + gönderilenler) ve gönderirken bildirim satırlarını üretir.
"""
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import (
    User, UserRole, Class, ChildProfile, Module, Lesson, LessonStep,
    Homework, HomeworkRecipient, CustomTabSection, Notification, NotificationType,
)

router = APIRouter(prefix="/homework", tags=["homework"])


def _ensure_teacher(u: User):
    if u.role != UserRole.teacher:
        raise HTTPException(403, "Teachers only")


async def _child_belongs_to_teacher(child: ChildProfile, teacher_id: int, db: AsyncSession) -> bool:
    """`teacher.py::_get_child_for_teacher` ile AYNI kural: çocuk doğrudan bu
    antrenöre bağlıysa YA DA sınıfı bu antrenöre aitse."""
    if child.teacher_user_id == teacher_id:
        return True
    if child.class_id is not None:
        cls = await db.get(Class, child.class_id)
        return cls is not None and cls.teacher_user_id == teacher_id
    return False


def _step_title(step: LessonStep) -> str:
    return (step.content_json or {}).get("title") or f"#{step.id}"


async def _resolve_step_chain(db: AsyncSession, step: LessonStep) -> tuple[str, str | None, str | None]:
    """(alt_konu_title, konu_title, duzey_title) — /homework/target ve bildirim
    metni üretimi (send_homework) AYNI zinciri kullanır."""
    lesson = await db.get(Lesson, step.lesson_id)
    module = await db.get(Module, lesson.module_id) if lesson else None
    return _step_title(step), (lesson.title if lesson else None), (module.name if module else None)


@router.get("/target")
async def homework_target(
    section_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """"Ödev Gönder" sayfası açılınca — antrenör "Çalışmalar/Dersler"de
    HANGİ Alt Konu'yu anlatıyorsa (section_id), onun müfredat karşılığını
    (linked_lesson_step_id, Faz 2) ve başlık zincirini döner. Bağ yoksa
    `linked: false` — sayfa "bu alt konu müfredata bağlı değil" der."""
    _ensure_teacher(current)
    section = await db.get(CustomTabSection, section_id)
    if not section:
        raise HTTPException(404, "Bölüm bulunamadı")
    step_id = section.linked_lesson_step_id
    if step_id is None:
        return {"linked": False, "section_title": section.title}
    step = await db.get(LessonStep, step_id)
    if not step:
        return {"linked": False, "section_title": section.title}
    alt_konu_title, konu_title, duzey_title = await _resolve_step_chain(db, step)
    return {
        "linked": True,
        "lesson_step_id": step_id,
        "alt_konu_title": alt_konu_title,
        "konu_title": konu_title,
        "duzey_title": duzey_title,
        "section_title": section.title,
    }


class SendHomeworkRequest(BaseModel):
    lesson_step_id: int
    source_section_id: int | None = None
    child_ids: list[int] = Field(default_factory=list)
    class_ids: list[int] = Field(default_factory=list)
    start_date: str  # ISO "YYYY-MM-DD"
    end_date: str | None = None
    note: str | None = Field(default=None, max_length=2000)


@router.post("", status_code=201)
async def send_homework(
    payload: SendHomeworkRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)

    step = await db.get(LessonStep, payload.lesson_step_id)
    if not step:
        raise HTTPException(404, "Ödev hedefi (ders adımı) bulunamadı")

    try:
        start = date_type.fromisoformat(payload.start_date)
    except ValueError:
        raise HTTPException(422, "Başlangıç tarihi geçersiz")
    end = None
    if payload.end_date:
        try:
            end = date_type.fromisoformat(payload.end_date)
        except ValueError:
            raise HTTPException(422, "Bitiş tarihi geçersiz")
        if end < start:
            raise HTTPException(422, "Bitiş tarihi başlangıçtan önce olamaz")

    # Alıcıları topla: class_ids → o sınıfların MEVCUT öğrencileri (via_class_id
    # işaretli), + tek tek seçilen child_ids. Çakışırsa sınıf kazanır.
    via_class: dict[int, int] = {}
    for cid in set(payload.class_ids):
        cls = await db.get(Class, cid)
        if not cls or cls.teacher_user_id != current.id:
            raise HTTPException(403, "Bu sınıf sizin değil")
        students = (await db.execute(
            select(ChildProfile.id).where(ChildProfile.class_id == cid)
        )).scalars().all()
        for sid in students:
            via_class.setdefault(sid, cid)

    explicit: set[int] = set()
    for child_id in set(payload.child_ids):
        child = await db.get(ChildProfile, child_id)
        if not child:
            raise HTTPException(404, f"Sporcu bulunamadı: {child_id}")
        if not await _child_belongs_to_teacher(child, current.id, db):
            raise HTTPException(403, "Bu sporcu sizin öğrenciniz değil")
        if child_id not in via_class:
            explicit.add(child_id)

    recipient_ids = sorted(set(via_class) | explicit)
    if not recipient_ids:
        raise HTTPException(422, "En az bir sporcu seçmelisiniz")

    hw = Homework(
        teacher_user_id=current.id,
        lesson_step_id=payload.lesson_step_id,
        source_custom_tab_section_id=payload.source_section_id,
        start_date=start,
        end_date=end,
        note=(payload.note.strip() or None) if payload.note else None,
    )
    db.add(hw)
    await db.flush()
    for rid in recipient_ids:
        db.add(HomeworkRecipient(
            homework_id=hw.id, child_id=rid, via_class_id=via_class.get(rid),
        ))

    # Madde 2026-09-11 (Ödev Sistemi Faz 4): her alıcıya "Bildirimler"
    # sekmesinde görünecek bir satır — start_date'ten ÖNCE görünmez
    # (visible_from). Başlık/alt başlık gönderim anında SABİTLENİR (snapshot)
    # — Alt Konu/ders adı sonradan değişse bile bildirim metni bozulmaz.
    alt_konu_title, konu_title, duzey_title = await _resolve_step_chain(db, step)
    subtitle = " › ".join(t for t in (duzey_title, konu_title) if t) or None
    for rid in recipient_ids:
        db.add(Notification(
            child_id=rid, type=NotificationType.odev,
            title=f"Yeni Ödev: {alt_konu_title}", subtitle=subtitle,
            visible_from=start, homework_id=hw.id,
        ))

    await db.commit()
    await db.refresh(hw)
    return {"id": hw.id, "recipient_count": len(recipient_ids)}


@router.get("/sent")
async def list_sent_homework(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bu antrenörün gönderdiği ödevler — en yeni önce, alıcı sayısı +
    Alt Konu başlığıyla."""
    _ensure_teacher(current)
    rows = (await db.execute(
        select(Homework).where(Homework.teacher_user_id == current.id)
        .order_by(Homework.created_at.desc())
    )).scalars().all()
    if not rows:
        return []
    step_ids = {h.lesson_step_id for h in rows}
    steps = {s.id: s for s in (await db.execute(
        select(LessonStep).where(LessonStep.id.in_(step_ids))
    )).scalars().all()}
    counts: dict[int, int] = {}
    names: dict[int, list[str]] = {}
    hw_ids = [h.id for h in rows]
    rec_rows = (await db.execute(
        select(HomeworkRecipient.homework_id, ChildProfile.display_name)
        .join(ChildProfile, ChildProfile.id == HomeworkRecipient.child_id)
        .where(HomeworkRecipient.homework_id.in_(hw_ids))
    )).all()
    for hw_id, name in rec_rows:
        counts[hw_id] = counts.get(hw_id, 0) + 1
        names.setdefault(hw_id, []).append(name)
    return [
        {
            "id": h.id,
            "lesson_step_id": h.lesson_step_id,
            "alt_konu_title": _step_title(steps[h.lesson_step_id]) if h.lesson_step_id in steps else None,
            "start_date": h.start_date.isoformat(),
            "end_date": h.end_date.isoformat() if h.end_date else None,
            "note": h.note,
            "recipient_count": counts.get(h.id, 0),
            "recipient_names": names.get(h.id, []),
            "created_at": h.created_at.isoformat(),
        }
        for h in rows
    ]
