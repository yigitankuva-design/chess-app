import secrets
import string
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, UserRole, Class, ClassAssignment, ChildProfile, ParentSurvey
from chess_api.services.leaderboard import class_leaderboard
from chess_api.routers.gamification import _compute_progress
from chess_api.routers.activity import _compute_day_summary
from chess_api.routers.practice import (
    _compute_lesson_scores, _compute_practice_detail,
    _compute_attempts_summary, _compute_attempts,
)
from pydantic import BaseModel, Field

_ALPHABET = string.ascii_uppercase + string.digits


class CreateClassRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class CreateAssignmentRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = None
    target_module_id: int | None = None
    target_lesson_id: int | None = None
    # Madde 2026-09-07 (GRUP D): DERS İÇİNDEKİ belirli bir Alt Konu
    # (lesson_step) hedeflenirse, o Alt Konu'nun "Ödevini Yap" sekmesi
    # sporcu tarafında aktifleşir (bkz. GET /assignments/my-active-step-ids).
    target_lesson_step_id: int | None = None
    due_date: str | None = None  # ISO date string
    # Madde 2026-09-05: bu ödev Antrenör'de bir Alt Konu anlatılırken
    # verildiyse, o düğümün id'si — izlenebilirlik için (opsiyonel).
    source_custom_tab_section_id: int | None = None


class CreateSurveyRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    questions: list[dict]


router = APIRouter(prefix="/teacher", tags=["teacher"])


def _ensure_teacher(u: User):
    if u.role != UserRole.teacher:
        raise HTTPException(403, "Teachers only")


@router.get("/classes")
async def list_classes(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    result = await db.execute(
        select(Class).where(Class.teacher_user_id == current.id)
    )
    return [
        {"id": c.id, "name": c.name, "join_code": c.join_code}
        for c in result.scalars().all()
    ]


@router.post("/classes", status_code=201)
async def create_class(
    payload: CreateClassRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = Class(
        teacher_user_id=current.id,
        name=payload.name,
        join_code=''.join(secrets.choice(_ALPHABET) for _ in range(8)),
    )
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return {"id": cls.id, "name": cls.name, "join_code": cls.join_code}


@router.get("/classes/{class_id}/students")
async def class_students(
    class_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    result = await db.execute(
        select(ChildProfile).where(ChildProfile.class_id == class_id)
    )
    return [
        {"id": c.id, "display_name": c.display_name, "avatar": c.avatar, "age": c.age}
        for c in result.scalars().all()
    ]


@router.get("/students/search")
async def search_students(
    q: str = "",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search children by display_name; include their current class name if enrolled."""
    _ensure_teacher(current)
    stmt = select(ChildProfile)
    if q.strip():
        stmt = stmt.where(ChildProfile.display_name.ilike(f"%{q.strip()}%"))
    stmt = stmt.limit(20)
    result = await db.execute(stmt)
    children = result.scalars().all()

    # Fetch class names for enrolled children
    class_ids = {c.class_id for c in children if c.class_id is not None}
    class_names: dict[int, str] = {}
    if class_ids:
        cls_result = await db.execute(select(Class).where(Class.id.in_(class_ids)))
        for cls in cls_result.scalars().all():
            class_names[cls.id] = cls.name

    return [
        {
            "id": c.id,
            "display_name": c.display_name,
            "avatar": c.avatar,
            "class_id": c.class_id,
            "class_name": class_names.get(c.class_id) if c.class_id else None,
        }
        for c in children
    ]


async def _get_child_for_teacher(
    child_id: int, current: User, db: AsyncSession,
) -> ChildProfile:
    """Madde 2026-09-07 (GRUP B): antrenör bir sporcunun GERÇEK Sporcu
    Profili'ni (salt-okunur) görüntüleyebilsin diye — bu çocuğun antrenörün
    KENDİ öğrencisi olduğunu doğrular (`class_students` ile AYNI desen:
    `child.teacher_user_id` DOĞRUDAN bu antrenöre bağlıysa YA DA
    `child.class_id`'nin sınıfı bu antrenöre aitse izin verilir)."""
    _ensure_teacher(current)
    child = await db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(404, "Child not found")
    allowed = child.teacher_user_id == current.id
    if not allowed and child.class_id is not None:
        cls = await db.get(Class, child.class_id)
        allowed = cls is not None and cls.teacher_user_id == current.id
    if not allowed:
        raise HTTPException(403, "Not your student")
    return child


@router.get("/me/profile-summary")
async def teacher_profile_summary(
    current: User = Depends(get_current_user),
):
    """Madde 2026-09-07 (Antrenör Paneli): antrenörün KENDİ Profil sayfası
    (`/coach/profile`) sporcunun ProfileView'ını (bkz. components/profile/
    ProfileView.tsx) aynen kullanıyor — o bileşen `/gamification/me`'nin
    döndürdüğü `MyProgress` şeklini bekliyor. Antrenörün rütbe/XP/rozet/
    fotoğraf/il/iletişim sistemi YOK (bunlar SADECE ChildProfile'da) — bu
    yüzden burada sadece gerçekten var olan alanlar (isim, üyelik tarihi)
    doldurulur, geri kalanı NULL/0 döner. ProfileView bunları zaten
    "ikon avatar göster"/"bilgi eksik" olarak gösteriyor (KURAL #3)."""
    _ensure_teacher(current)
    return {
        "rank_name": "", "rank_icon": "", "xp_total": 0, "next_rank_xp": 0,
        "badges_earned": 0, "badges_total": 0,
        "member_since": current.created_at.date().isoformat(),
        "display_name": current.name,
        "avatar": "default",
        "photo_data_url": None,
        "province": None,
        "athlete_phone": None, "athlete_email": None,
        "father_name": None, "father_phone": None, "father_email": None,
        "mother_name": None, "mother_phone": None, "mother_email": None,
    }


@router.get("/students/{child_id}/profile-summary")
async def student_profile_summary(
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/gamification/me` ile AYNI veri + antrenör görünümü için isim/avatar
    (çocuğun kendi ekranında bunlar zaten cihazından geliyor — antrenör
    görünümünde sunucudan gelmesi gerekir, bkz. ProfileView.tsx)."""
    child = await _get_child_for_teacher(child_id, current, db)
    progress = await _compute_progress(child, db)
    return {**progress, "display_name": child.display_name, "avatar": child.avatar}


@router.get("/students/{child_id}/day-summary")
async def student_day_summary(
    child_id: int,
    date_str: str | None = None,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/activity/day-summary` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_day_summary(child, date_str, db)


@router.get("/students/{child_id}/practice/lessons/{lesson_id}/scores")
async def student_lesson_scores(
    child_id: int,
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/lessons/{id}/scores` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_lesson_scores(child.id, lesson_id, db)


@router.get("/students/{child_id}/practice/steps/{step_id}/detail")
async def student_practice_detail(
    child_id: int,
    step_id: int,
    mode: str = "suresiz",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/steps/{id}/detail` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_practice_detail(child.id, step_id, mode, db)


@router.get("/students/{child_id}/practice/steps/{step_id}/attempts-summary")
async def student_attempts_summary(
    child_id: int,
    step_id: int,
    mode: str = "sureli",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/steps/{id}/attempts-summary` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_attempts_summary(child.id, step_id, mode, db)


@router.get("/students/{child_id}/practice/steps/{step_id}/attempts")
async def student_attempts(
    child_id: int,
    step_id: int,
    mode: str = "test",
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """`/practice/steps/{id}/attempts` ile AYNI veri — antrenörün salt-okunur görünümü."""
    child = await _get_child_for_teacher(child_id, current, db)
    return await _compute_attempts(child.id, step_id, mode, db)


@router.post("/classes/{class_id}/students/{child_id}", status_code=200)
async def add_student(
    class_id: int,
    child_id: int,
    force: bool = False,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    child = await db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(404, "Child not found")
    if child.class_id is not None and child.class_id != class_id and not force:
        raise HTTPException(409, "Bu öğrenci zaten başka bir sınıfa kayıtlı")
    child.class_id = class_id
    await db.commit()
    return {"ok": True}


@router.delete("/classes/{class_id}/students/{child_id}", status_code=200)
async def remove_student(
    class_id: int,
    child_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    child = await db.get(ChildProfile, child_id)
    if not child or child.class_id != class_id:
        raise HTTPException(404, "Student not in this class")
    child.class_id = None
    await db.commit()
    return {"ok": True}


def _ensure_has_target(payload: CreateAssignmentRequest):
    """Madde 2026-09-05: bir ödev Dersler'de bir yere işaret ETMELİDİR —
    modül, ders veya (madde 2026-09-07, GRUP D) belirli bir Alt Konu
    (lesson_step) — en az biri şart."""
    if (
        payload.target_module_id is None
        and payload.target_lesson_id is None
        and payload.target_lesson_step_id is None
    ):
        raise HTTPException(422, "Ödev bir modül, ders veya Alt Konu hedeflemeli")


@router.post("/classes/{class_id}/assignments", status_code=201)
async def create_assignment(
    class_id: int,
    payload: CreateAssignmentRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    _ensure_has_target(payload)
    assignment = ClassAssignment(
        teacher_user_id=current.id,
        class_id=class_id,
        title=payload.title,
        description=payload.description,
        target_module_id=payload.target_module_id,
        target_lesson_id=payload.target_lesson_id,
        target_lesson_step_id=payload.target_lesson_step_id,
        source_custom_tab_section_id=payload.source_custom_tab_section_id,
        due_date=date_type.fromisoformat(payload.due_date) if payload.due_date else None,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return {"id": assignment.id}


@router.post("/students/{child_id}/assignments", status_code=201)
async def create_individual_assignment(
    child_id: int,
    payload: CreateAssignmentRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-05: sınıf yerine TEK bir sporcuya doğrudan ödev ata —
    `/classes/{id}/assignments` ile AYNI desen, sadece class_id yerine
    target_child_id doldurulur."""
    _ensure_teacher(current)
    _ensure_has_target(payload)
    child = await db.get(ChildProfile, child_id)
    if not child:
        raise HTTPException(404, "Child not found")
    assignment = ClassAssignment(
        teacher_user_id=current.id,
        target_child_id=child_id,
        title=payload.title,
        description=payload.description,
        target_module_id=payload.target_module_id,
        target_lesson_id=payload.target_lesson_id,
        target_lesson_step_id=payload.target_lesson_step_id,
        source_custom_tab_section_id=payload.source_custom_tab_section_id,
        due_date=date_type.fromisoformat(payload.due_date) if payload.due_date else None,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return {"id": assignment.id}


@router.get("/assignments")
async def list_my_assignments(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-05: Zafer'in (bu öğretmen hesabının) verdiği TÜM
    ödevler — sınıfa ve bireysel olanlar birlikte, en yeni önce."""
    _ensure_teacher(current)
    result = await db.execute(
        select(ClassAssignment)
        .where(ClassAssignment.teacher_user_id == current.id)
        .order_by(ClassAssignment.created_at.desc())
    )
    assignments = result.scalars().all()

    class_ids = {a.class_id for a in assignments if a.class_id is not None}
    class_names: dict[int, str] = {}
    if class_ids:
        cls_result = await db.execute(select(Class).where(Class.id.in_(class_ids)))
        class_names = {c.id: c.name for c in cls_result.scalars().all()}

    child_ids = {a.target_child_id for a in assignments if a.target_child_id is not None}
    child_names: dict[int, str] = {}
    if child_ids:
        child_result = await db.execute(select(ChildProfile).where(ChildProfile.id.in_(child_ids)))
        child_names = {c.id: c.display_name for c in child_result.scalars().all()}

    return [
        {
            "id": a.id,
            "title": a.title,
            "description": a.description,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "target_module_id": a.target_module_id,
            "target_lesson_id": a.target_lesson_id,
            "target_lesson_step_id": a.target_lesson_step_id,
            "class_id": a.class_id,
            "class_name": class_names.get(a.class_id) if a.class_id else None,
            "target_child_id": a.target_child_id,
            "target_child_name": child_names.get(a.target_child_id) if a.target_child_id else None,
            "source_custom_tab_section_id": a.source_custom_tab_section_id,
        }
        for a in assignments
    ]


@router.get("/classes/{class_id}/leaderboard")
async def get_leaderboard(
    class_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    cls = await db.get(Class, class_id)
    if not cls or cls.teacher_user_id != current.id:
        raise HTTPException(403)
    return await class_leaderboard(db, class_id)


@router.post("/surveys", status_code=201)
async def create_survey(
    payload: CreateSurveyRequest,
    target_class_id: int | None = None,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_teacher(current)
    if target_class_id is not None:
        cls = await db.get(Class, target_class_id)
        if not cls or cls.teacher_user_id != current.id:
            raise HTTPException(403, "Not your class")
    survey = ParentSurvey(
        title=payload.title,
        questions_json=payload.questions,
        created_by_teacher_id=current.id,
        target_class_id=target_class_id,
    )
    db.add(survey)
    await db.commit()
    return {"id": survey.id}
