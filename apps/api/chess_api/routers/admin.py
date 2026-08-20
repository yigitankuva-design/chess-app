from datetime import datetime
import chess
from fastapi import APIRouter, Depends, HTTPException, Body, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
import re
from chess_api.models import User, UserRole, ChildProfile, ParentSurveyResponse, Device, AppSettings
from chess_api.models.module import Module, Lesson, LessonStep, LessonStepType
from chess_api.models.progress import ChildLessonProgress, LessonStatus
from chess_api.dependencies.auth import get_current_user
from chess_api.services.password import hash_password
from chess_api.services.child_deletion import delete_child_cascade
from chess_api.schemas.auth import (
    AdminParentSummary, AdminParentDetail, AdminChildSummary,
    AdminOverview, AdminModuleSummary, AdminResetPasswordRequest,
    AdminLessonSummary,
    ContentExport, ContentModuleIO, ContentLessonIO, ContentStepIO,
    ContentImportRequest, ContentImportResult,
    ModuleCreateRequest, ModuleUpdateRequest, ReorderRequest,
    LessonCreateRequest, LessonUpdateRequest, LessonPublishRequest, AdminLessonDetail,
    StepCreateRequest, StepUpdateRequest, AdminStepDetail,
)
from chess_api.models.progress import ChildLessonStepResult
from chess_api.models.practice import ChildPracticeResult
from chess_api.models.opening import Opening
from chess_api.models.pool_image import PoolImage
from chess_api.models.custom_tab import CustomTab, CustomTabSection
from chess_api.models.tournament import (
    Tournament, TournamentStatus, TournamentParticipant, TournamentPairing,
)
from chess_api.schemas.tournament import TournamentCreateRequest
from chess_api.services.tournaments import generate_pairings
from chess_api.pool_categories import POOL_CATEGORIES

router = APIRouter(prefix="/admin", tags=["admin"])


def _ensure_admin(u: User):
    if u.role != UserRole.teacher:
        raise HTTPException(status_code=403, detail="Admin (teacher) only")


@router.get("/parents", response_model=list[AdminParentSummary])
async def list_parents(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    parents = (await db.execute(
        select(User).where(User.role == UserRole.parent).order_by(User.created_at.desc())
    )).scalars().all()
    out = []
    for p in parents:
        names = (await db.execute(
            select(ChildProfile.display_name).where(ChildProfile.parent_user_id == p.id)
        )).scalars().all()
        out.append(AdminParentSummary(
            id=p.id, name=p.name, email=p.email,
            created_at=p.created_at, child_count=len(names), child_names=list(names),
        ))
    return out


@router.get("/parents/{parent_id}", response_model=AdminParentDetail)
async def parent_detail(
    parent_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    p = await db.get(User, parent_id)
    if not p or p.role != UserRole.parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    children = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == parent_id)
    )).scalars().all()
    child_out = []
    for c in children:
        completed = (await db.execute(
            select(func.count(ChildLessonProgress.id)).where(
                ChildLessonProgress.child_id == c.id,
                ChildLessonProgress.status == LessonStatus.completed,
            )
        )).scalar_one()
        child_out.append(AdminChildSummary(
            id=c.id, display_name=c.display_name, age=c.age,
            avatar=c.avatar, completed_lessons=completed,
        ))
    return AdminParentDetail(
        id=p.id, name=p.name, email=p.email,
        created_at=p.created_at, children=child_out,
    )


@router.get("/overview", response_model=AdminOverview)
async def overview(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    total_parents = (await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.parent)
    )).scalar_one()
    total_teachers = (await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.teacher)
    )).scalar_one()
    total_children = (await db.execute(
        select(func.count(ChildProfile.id))
    )).scalar_one()
    return AdminOverview(
        total_parents=total_parents,
        total_children=total_children,
        total_teachers=total_teachers,
    )


@router.get("/content", response_model=list[AdminModuleSummary])
async def content(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    modules = (await db.execute(
        select(Module).order_by(Module.order_index)
    )).scalars().all()
    out = []
    for m in modules:
        lc = (await db.execute(
            select(func.count(Lesson.id)).where(Lesson.module_id == m.id)
        )).scalar_one()
        out.append(AdminModuleSummary(
            id=m.id, order_index=m.order_index, name=m.name, lesson_count=lc, icon=m.icon,
        ))
    return out


@router.get("/modules/{module_id}/lessons", response_model=list[AdminLessonDetail])
async def module_lessons(
    module_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    lessons = (await db.execute(
        select(Lesson).where(Lesson.module_id == module_id).order_by(Lesson.order_index)
    )).scalars().all()
    out = []
    for les in lessons:
        sc = (await db.execute(
            select(func.count(LessonStep.id)).where(LessonStep.lesson_id == les.id)
        )).scalar_one()
        out.append(AdminLessonDetail(
            id=les.id, module_id=les.module_id, order_index=les.order_index, title=les.title,
            estimated_minutes=les.estimated_minutes, published=les.published, step_count=sc,
        ))
    return out


@router.post("/parents/{parent_id}/reset-password")
async def reset_parent_password(
    parent_id: int,
    payload: AdminResetPasswordRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    p = await db.get(User, parent_id)
    if not p or p.role != UserRole.parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    p.password_hash = hash_password(payload.new_password)
    await db.commit()
    return {"reset": True}


@router.delete("/parents/{parent_id}")
async def delete_parent(
    parent_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    p = await db.get(User, parent_id)
    if not p or p.role != UserRole.parent:
        raise HTTPException(status_code=404, detail="Parent not found")

    # Her çocuğu bağımlı kayıtlarıyla FK-güvenli sil
    children = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == parent_id)
    )).scalars().all()
    for c in children:
        await delete_child_cascade(db, c)

    # Parent'a doğrudan bağlı kayıtlar (child'lar silindikten sonra)
    await db.execute(delete(ParentSurveyResponse).where(ParentSurveyResponse.parent_user_id == parent_id))
    await db.execute(delete(Device).where(Device.parent_user_id == parent_id))

    await db.delete(p)
    await db.commit()
    return {"deleted": True}


@router.get("/content/export", response_model=ContentExport)
async def content_export(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    modules = (await db.execute(select(Module).order_by(Module.order_index))).scalars().all()
    out_modules = []
    for m in modules:
        lessons = (await db.execute(
            select(Lesson).where(Lesson.module_id == m.id).order_by(Lesson.order_index)
        )).scalars().all()
        out_lessons = []
        for les in lessons:
            steps = (await db.execute(
                select(LessonStep).where(LessonStep.lesson_id == les.id).order_by(LessonStep.order_index)
            )).scalars().all()
            out_lessons.append(ContentLessonIO(
                id=les.id, order_index=les.order_index, title=les.title,
                estimated_minutes=les.estimated_minutes,
                steps=[
                    ContentStepIO(
                        id=s.id, order_index=s.order_index, type=s.type.value,
                        content_json=s.content_json, correct_answer_json=s.correct_answer_json,
                    ) for s in steps
                ],
            ))
        out_modules.append(ContentModuleIO(
            id=m.id, order_index=m.order_index, name=m.name,
            description=m.description, icon=m.icon, lessons=out_lessons,
        ))
    return ContentExport(exported_at=datetime.utcnow(), version=1, modules=out_modules)


@router.post("/content/import", response_model=ContentImportResult)
async def content_import(
    payload: ContentImportRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """İçeriği JSON'dan geri yükler. UPSERT — asla silmez.

    ID'ler korunur; böylece child_lesson_progress FK'leri ve çocuk ilerlemesi bozulmaz.
    """
    _ensure_admin(current)
    if payload.version != 1:
        raise HTTPException(status_code=400, detail="Unsupported version")

    counts = {"modules_updated": 0, "modules_created": 0,
              "lessons_updated": 0, "lessons_created": 0,
              "steps_updated": 0, "steps_created": 0}

    for m_io in payload.modules:
        module = await db.get(Module, m_io.id) if m_io.id else None
        if module:
            module.order_index = m_io.order_index
            module.name = m_io.name
            module.description = m_io.description
            module.icon = m_io.icon
            counts["modules_updated"] += 1
        else:
            module = Module(order_index=m_io.order_index, name=m_io.name,
                            description=m_io.description, icon=m_io.icon)
            db.add(module)
            counts["modules_created"] += 1
        await db.flush()

        for l_io in m_io.lessons:
            lesson = await db.get(Lesson, l_io.id) if l_io.id else None
            if lesson:
                lesson.module_id = module.id
                lesson.order_index = l_io.order_index
                lesson.title = l_io.title
                lesson.estimated_minutes = l_io.estimated_minutes
                counts["lessons_updated"] += 1
            else:
                lesson = Lesson(module_id=module.id, order_index=l_io.order_index,
                                title=l_io.title, estimated_minutes=l_io.estimated_minutes)
                db.add(lesson)
                counts["lessons_created"] += 1
            await db.flush()

            for s_io in l_io.steps:
                try:
                    step_type = LessonStepType(s_io.type)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid step type: {s_io.type}")
                step = await db.get(LessonStep, s_io.id) if s_io.id else None
                if step:
                    step.lesson_id = lesson.id
                    step.order_index = s_io.order_index
                    step.type = step_type
                    step.content_json = s_io.content_json
                    step.correct_answer_json = s_io.correct_answer_json
                    counts["steps_updated"] += 1
                else:
                    step = LessonStep(lesson_id=lesson.id, order_index=s_io.order_index,
                                      type=step_type, content_json=s_io.content_json,
                                      correct_answer_json=s_io.correct_answer_json)
                    db.add(step)
                    counts["steps_created"] += 1
                await db.flush()

    await db.commit()
    return ContentImportResult(**counts)


@router.post("/modules", status_code=201)
async def create_module(
    payload: ModuleCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    max_order = (await db.execute(select(func.max(Module.order_index)))).scalar_one_or_none() or 0
    module = Module(order_index=max_order + 1, name=payload.name,
                    description=payload.description, icon=payload.icon)
    db.add(module)
    await db.commit()
    await db.refresh(module)
    return {"id": module.id, "order_index": module.order_index, "name": module.name,
            "description": module.description, "icon": module.icon}


@router.patch("/modules/{module_id}")
async def update_module(
    module_id: int,
    payload: ModuleUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if payload.name is not None:
        module.name = payload.name
    if payload.description is not None:
        module.description = payload.description
    if payload.icon is not None:
        module.icon = payload.icon
    await db.commit()
    await db.refresh(module)
    return {"id": module.id, "order_index": module.order_index, "name": module.name,
            "description": module.description, "icon": module.icon}


@router.post("/modules/reorder")
async def reorder_modules(
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """modules.order_index UNIQUE olduğu için İKİ AŞAMALI yazılır:
    önce geçici negatif değerler, sonra kesin değerler. Yoksa unique çakışır."""
    _ensure_admin(current)
    modules = (await db.execute(
        select(Module).where(Module.id.in_(payload.ordered_ids))
    )).scalars().all()
    by_id = {m.id: m for m in modules}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown module id")

    for i, mid in enumerate(payload.ordered_ids):
        by_id[mid].order_index = -(i + 1)
    await db.flush()
    for i, mid in enumerate(payload.ordered_ids):
        by_id[mid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.delete("/modules/{module_id}")
async def delete_module(
    module_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    lesson_count = (await db.execute(
        select(func.count(Lesson.id)).where(Lesson.module_id == module_id)
    )).scalar_one()
    if lesson_count:
        raise HTTPException(status_code=409, detail="Bu düzeyde ders var. Önce dersleri taşıyın veya silin.")
    await db.delete(module)
    await db.commit()
    return {"deleted": True}


def _lesson_out(les: Lesson, step_count: int) -> dict:
    return {"id": les.id, "module_id": les.module_id, "order_index": les.order_index,
            "title": les.title, "estimated_minutes": les.estimated_minutes,
            "published": les.published, "step_count": step_count, "icon": les.icon}


@router.post("/modules/{module_id}/lessons", status_code=201)
async def create_lesson(
    module_id: int,
    payload: LessonCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    module = await db.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    max_order = (await db.execute(
        select(func.max(Lesson.order_index)).where(Lesson.module_id == module_id)
    )).scalar_one_or_none() or 0
    lesson = Lesson(module_id=module_id, order_index=max_order + 1, title=payload.title,
                    estimated_minutes=payload.estimated_minutes, published=False,
                    icon=payload.icon)
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return _lesson_out(lesson, 0)


@router.patch("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: int,
    payload: LessonUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if payload.title is not None:
        lesson.title = payload.title
    if payload.estimated_minutes is not None:
        lesson.estimated_minutes = payload.estimated_minutes
    if payload.icon is not None:
        lesson.icon = payload.icon
    if payload.module_id is not None and payload.module_id != lesson.module_id:
        target = await db.get(Module, payload.module_id)
        if not target:
            raise HTTPException(status_code=404, detail="Target module not found")
        max_order = (await db.execute(
            select(func.max(Lesson.order_index)).where(Lesson.module_id == payload.module_id)
        )).scalar_one_or_none() or 0
        lesson.module_id = payload.module_id
        lesson.order_index = max_order + 1
    await db.commit()
    await db.refresh(lesson)
    sc = (await db.execute(
        select(func.count(LessonStep.id)).where(LessonStep.lesson_id == lesson.id)
    )).scalar_one()
    return _lesson_out(lesson, sc)


@router.post("/lessons/{lesson_id}/publish")
async def publish_lesson(
    lesson_id: int,
    payload: LessonPublishRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.published = payload.published
    await db.commit()
    await db.refresh(lesson)
    sc = (await db.execute(
        select(func.count(LessonStep.id)).where(LessonStep.lesson_id == lesson.id)
    )).scalar_one()
    return _lesson_out(lesson, sc)


@router.post("/modules/{module_id}/lessons/reorder")
async def reorder_lessons(
    module_id: int,
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lessons = (await db.execute(
        select(Lesson).where(Lesson.id.in_(payload.ordered_ids), Lesson.module_id == module_id)
    )).scalars().all()
    by_id = {l.id: l for l in lessons}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown lesson id")
    for i, lid in enumerate(payload.ordered_ids):
        by_id[lid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """İlerlemesi olan ders SİLİNMEZ — yayından kaldırılır. Çocuk emeği korunur."""
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    prog = (await db.execute(
        select(func.count(ChildLessonProgress.id)).where(ChildLessonProgress.lesson_id == lesson_id)
    )).scalar_one()
    step_ids = (await db.execute(
        select(LessonStep.id).where(LessonStep.lesson_id == lesson_id)
    )).scalars().all()
    results = 0
    practice_results = 0
    if step_ids:
        results = (await db.execute(
            select(func.count(ChildLessonStepResult.id)).where(
                ChildLessonStepResult.lesson_step_id.in_(step_ids)
            )
        )).scalar_one()
        practice_results = (await db.execute(
            select(func.count(ChildPracticeResult.id)).where(
                ChildPracticeResult.lesson_step_id.in_(step_ids)
            )
        )).scalar_one()
    if prog or results or practice_results:
        raise HTTPException(
            status_code=409,
            detail="Bu derse ait çocuk ilerlemesi var. Silmek yerine yayından kaldırabilirsiniz.",
        )

    await db.execute(delete(LessonStep).where(LessonStep.lesson_id == lesson_id))
    await db.delete(lesson)
    await db.commit()
    return {"deleted": True}


BOARD_EXERCISE_TYPES = ("click_square", "move_piece", "identify_piece", "place_pieces", "click_piece")
MAX_EXERCISE_IMAGE_BYTES = 400_000


def _check_data_uri_size(value: object, field_label: str) -> None:
    """data-URI'nin gerçek bayt boyutunu kontrol eder (tarayıcı sıkıştırmasının ikinci savunma hattı)."""
    if not isinstance(value, str) or not value.startswith("data:image/"):
        raise HTTPException(status_code=400, detail=f"{field_label} geçerli bir görsel değil")
    if len(value.encode("utf-8")) > MAX_EXERCISE_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"{field_label} çok büyük (en fazla 400KB)")


CHOICE_EXERCISE_TYPES = ("sentence_question", "image_question")

PAINT_COLORS = {
    "#000000", "#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#a855f7",
    "#f97316", "#14b8a6", "#92400e", "#eab308",
}
PAINT_SHAPES = {"circle", "square", "rectangle", "star", "arrow", "question"}


def _validate_annotations(items: object) -> None:
    """Tahtaya eklenen serbest yazı/şekil/renk öğelerini doğrular (C grubu).

    Öğe SAYISINDA sınır yok (kullanıcı onayı) — her öğenin kendi alanları
    mantıklı aralıkta mı bakılır, bozuk/aşırı büyük veri reddedilir.
    """
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="annotations bir liste olmalı")
    for idx, item in enumerate(items):
        label = f"{idx + 1}. çizim öğesi"
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"{label} nesne olmalı")
        if item.get("kind") not in ("text", "shape"):
            raise HTTPException(status_code=400, detail=f"{label} için geçersiz tür")
        if item.get("color") not in PAINT_COLORS:
            raise HTTPException(status_code=400, detail=f"{label} için geçersiz renk")
        x, y, rotation = item.get("x"), item.get("y"), item.get("rotation")
        for field_name, val, lo, hi in [("x", x, 0, 100), ("y", y, 0, 100), ("rotation", rotation, 0, 359)]:
            if not isinstance(val, (int, float)) or isinstance(val, bool) or val < lo or val > hi:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz {field_name}")
        if item["kind"] == "text":
            text = item.get("text")
            if not isinstance(text, str) or len(text) == 0 or len(text) > 200:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz yazı")
            font_size = item.get("fontSize")
            if not isinstance(font_size, (int, float)) or isinstance(font_size, bool) or font_size < 12 or font_size > 72:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz punto")
        else:
            if item.get("shape") not in PAINT_SHAPES:
                raise HTTPException(status_code=400, detail=f"{label} için geçersiz şekil")
            w, h = item.get("w"), item.get("h")
            for field_name, val in [("w", w), ("h", h)]:
                if not isinstance(val, (int, float)) or isinstance(val, bool) or val < 2 or val > 90:
                    raise HTTPException(status_code=400, detail=f"{label} için geçersiz {field_name}")


def _validate_image_placement(ex: dict) -> None:
    """image_x/y/w/h/tone/show_board hepsi OPSİYONEL — verilmişse aralık kontrolü.
    Eski sorularda bu alanlar hiç yok; o durumda hiçbir kontrol tetiklenmez (KURAL #3)."""
    ranges = (("image_x", 0, 100), ("image_y", 0, 100),
              ("image_w", 5, 90), ("image_h", 5, 90), ("image_tone", 0, 10))
    for field, lo, hi in ranges:
        if field in ex and ex[field] is not None:
            val = ex[field]
            if not isinstance(val, (int, float)) or isinstance(val, bool) or val < lo or val > hi:
                raise HTTPException(status_code=400, detail=f"{field} {lo}-{hi} arasında olmalı")
    if "image_show_board" in ex and ex["image_show_board"] is not None:
        if not isinstance(ex["image_show_board"], bool):
            raise HTTPException(status_code=400, detail="image_show_board doğru/yanlış olmalı")


def _validate_prompt_images(images: object) -> None:
    """Yeni çoklu-görsel formatı: her biri kendi konum/boyut/ton bilgisiyle
    bir liste. Boş liste veya liste-olmayan reddedilir."""
    if not isinstance(images, list) or len(images) == 0:
        raise HTTPException(status_code=400, detail="En az bir soru görseli gerekli")
    if len(images) > 20:
        raise HTTPException(status_code=400, detail="En fazla 20 görsel eklenebilir")
    ranges = (("x", 0, 100), ("y", 0, 100), ("w", 5, 90), ("h", 5, 90), ("tone", 0, 10))
    for idx, img in enumerate(images):
        if not isinstance(img, dict):
            raise HTTPException(status_code=400, detail=f"{idx + 1}. görsel geçersiz")
        _check_data_uri_size(img.get("uri"), f"{idx + 1}. görsel")
        for field, lo, hi in ranges:
            val = img.get(field)
            if not isinstance(val, (int, float)) or isinstance(val, bool) or val < lo or val > hi:
                raise HTTPException(
                    status_code=400,
                    detail=f"{idx + 1}. görsel {field} {lo}-{hi} arasında olmalı",
                )


def _validate_choice_exercise(ex: dict, ex_type: str) -> None:
    """sentence_question / image_question doğrulaması — tahtaya bağımlı değil."""
    if ex_type == "image_question":
        images = ex.get("prompt_images")
        legacy_img = ex.get("prompt_image")
        if images is not None:
            _validate_prompt_images(images)
        elif legacy_img:
            _check_data_uri_size(legacy_img, "Soru görseli")
            _validate_image_placement(ex)
        else:
            raise HTTPException(status_code=400, detail="Görsel soru için görsel gerekli")
    else:  # sentence_question
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(status_code=400, detail="Cümle sorusu için soru metni gerekli")
        fen = ex.get("fen")
        if fen is not None:
            _validate_fen(fen)

    options = ex.get("options")
    if not isinstance(options, list) or not (2 <= len(options) <= 4):
        raise HTTPException(status_code=400, detail="2, 3 veya 4 cevap seçeneği gerekli")

    answer_kind = ex.get("answer_kind")
    if answer_kind not in ("sentence", "image"):
        raise HTTPException(status_code=400, detail="Geçersiz cevap tipi")

    if answer_kind == "image":
        for i, opt in enumerate(options):
            _check_data_uri_size(opt, f"{i + 1}. cevap görseli")
    else:
        if any(not (o or "").strip() for o in options):
            raise HTTPException(status_code=400, detail="Boş cevap seçeneği olamaz")

    ci = ex.get("correct_index")
    if not isinstance(ci, int) or ci < 0 or ci >= len(options):
        raise HTTPException(status_code=400, detail="Doğru cevap seçimi geçersiz")

    if "annotations" in ex and ex["annotations"] is not None:
        _validate_annotations(ex["annotations"])


def _validate_board_exercises(exercises: list) -> None:
    """Anlatım adımının içindeki board_exercises dizisini doğrular.

    ÖNEMLİ: board.is_valid() KULLANILMAZ — hocanın öğretim pozisyonları kasten şahsızdır
    (boş tahta, tek piyon, tek at). is_valid() onlara False döner ve mevcut 60 alıştırmayı
    reddederdi. Sadece FEN parse edilebiliyor mu bakılır. legal_moves şahsız tahtada çalışır.
    """
    if not isinstance(exercises, list):
        raise HTTPException(status_code=400, detail="board_exercises bir liste olmalı")

    for ex in exercises:
        if not isinstance(ex, dict):
            raise HTTPException(status_code=400, detail="Alıştırma nesne olmalı")
        ex_type = ex.get("type")
        if ex_type not in BOARD_EXERCISE_TYPES + CHOICE_EXERCISE_TYPES:
            raise HTTPException(status_code=400, detail=f"Geçersiz alıştırma türü: {ex_type}")

        if "difficulty" in ex and ex["difficulty"] is not None:
            diff = ex["difficulty"]
            if not isinstance(diff, int) or diff < 1 or diff > 5:
                raise HTTPException(status_code=400, detail="Zorluk düzeyi 1-5 arasında olmalı")

        if ex_type in CHOICE_EXERCISE_TYPES:
            _validate_choice_exercise(ex, ex_type)
            continue

        # --- tahta sorusu doğrulaması ---
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(status_code=400, detail="Alıştırma talimatı boş olamaz")

        fen = ex.get("fen")
        if not fen:
            raise HTTPException(status_code=400, detail="Alıştırma için pozisyon (fen) gerekli")
        try:
            board = chess.Board(fen)
        except ValueError:
            raise HTTPException(status_code=400, detail="Pozisyon (fen) okunamadı")

        def _squares(key: str) -> list[str]:
            vals = ex.get(key)
            if not isinstance(vals, list) or not vals:
                raise HTTPException(status_code=400, detail=f"{key} boş olamaz")
            for s in vals:
                if s not in chess.SQUARE_NAMES:
                    raise HTTPException(status_code=400, detail=f"Geçersiz kare: {s}")
            return vals

        if ex_type == "click_square":
            _squares("target_squares")
            cm = ex.get("click_mode")
            if cm is not None and cm not in ("any", "all"):
                raise HTTPException(status_code=400, detail="click_mode 'any' veya 'all' olmalı")

        elif ex_type == "move_piece":
            # Yeni format: SAN hamle dizisi. Başlangıç pozisyonundan itibaren
            # her hamle sırayla oynatılır; kural dışı/sıraya aykırı olan reddedilir.
            # NOT: kurulu python-chess (1.2.0) InvalidMoveError/IllegalMoveError
            # alt sınıflarını İÇERMİYOR — hem bozuk hem kural dışı SAN için düz
            # ValueError fırlatıyor (gerçek ortamda doğrulandı).
            moves = ex.get("moves")
            if not isinstance(moves, list) or len(moves) < 1:
                raise HTTPException(status_code=400, detail="En az bir hamle kaydedilmeli")
            replay_board = chess.Board(fen)
            for i, san in enumerate(moves):
                if not isinstance(san, str):
                    raise HTTPException(status_code=400, detail=f"{i + 1}. hamle geçersiz")
                try:
                    parsed = replay_board.parse_san(san)
                except ValueError:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{i + 1}. hamle kurallara uygun değil: {san}",
                    )
                replay_board.push(parsed)

        elif ex_type == "identify_piece":
            hl = ex.get("highlight_square")
            if hl not in chess.SQUARE_NAMES:
                raise HTTPException(status_code=400, detail=f"Geçersiz vurgu karesi: {hl}")
            if board.piece_at(chess.parse_square(hl)) is None:
                raise HTTPException(status_code=400, detail=f"{hl} karesinde taş yok")
            options = ex.get("options")
            if not isinstance(options, list) or len(options) < 2:
                raise HTTPException(status_code=400, detail="En az 2 şık gerekli")
            ci = ex.get("correct_index")
            if not isinstance(ci, int) or ci < 0 or ci >= len(options):
                raise HTTPException(status_code=400, detail="Doğru şık geçersiz")

        elif ex_type == "place_pieces":
            # "Taş Nerde?": hoca konumu dizer, bir/birkaç taşı KASTEN koymaz.
            # Sporcu o taşları doğru karelere yerleştirir.
            pieces = ex.get("pieces")
            if not isinstance(pieces, list) or len(pieces) < 1:
                raise HTTPException(status_code=400, detail="En az bir taş belirlenmeli")
            seen: set[str] = set()
            for i, p in enumerate(pieces):
                if not isinstance(p, dict):
                    raise HTTPException(status_code=400, detail=f"{i + 1}. taş geçersiz")
                pc = p.get("piece")
                # SIRA ÖNEMLİ: uzunluk kontrolü ÖNCE — "" in "KQRBNP..." True döner.
                if not isinstance(pc, str) or len(pc) != 1 or pc not in "KQRBNPkqrbnp":
                    raise HTTPException(status_code=400, detail=f"Geçersiz taş: {pc}")
                sq = p.get("square")
                if sq not in chess.SQUARE_NAMES:
                    raise HTTPException(status_code=400, detail=f"Geçersiz kare: {sq}")
                if sq in seen:
                    raise HTTPException(status_code=400, detail=f"{sq} karesi iki kez verilmiş")
                seen.add(sq)
                if board.piece_at(chess.parse_square(sq)) is not None:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{sq} karesi dolu — eksik taşın karesi boş olmalı",
                    )

        elif ex_type == "click_piece":
            # "Taşa Tıkla": cevap TAŞTIR — hedef karelerde taş bulunmak ZORUNDA.
            squares = ex.get("piece_squares")
            if not isinstance(squares, list) or len(squares) < 1:
                raise HTTPException(status_code=400, detail="En az bir cevap taşı seçilmeli")
            seen_pieces: set[str] = set()
            for sq in squares:
                if sq not in chess.SQUARE_NAMES:
                    raise HTTPException(status_code=400, detail=f"Geçersiz kare: {sq}")
                if sq in seen_pieces:
                    raise HTTPException(status_code=400, detail=f"{sq} karesi iki kez verilmiş")
                seen_pieces.add(sq)
                if board.piece_at(chess.parse_square(sq)) is None:
                    raise HTTPException(status_code=400, detail=f"{sq} karesinde taş yok")

        if "annotations" in ex and ex["annotations"] is not None:
            _validate_annotations(ex["annotations"])


def _validate_step_content(step_type: LessonStepType, content: dict) -> None:
    """Editörden gelen içerik oynatıcının beklediği şekle uymalı; uymazsa çocukta bozuk görünür."""
    if step_type == LessonStepType.quiz:
        questions = content.get("questions")
        if not isinstance(questions, list) or not questions:
            raise HTTPException(status_code=400, detail="Quiz için en az bir soru gerekli")
        for q in questions:
            prompt = q.get("prompt")
            options = q.get("options")
            ci = q.get("correct_index")
            if not prompt or not isinstance(options, list) or len(options) < 2:
                raise HTTPException(status_code=400, detail="Her sorunun metni ve en az 2 şıkkı olmalı")
            if not isinstance(ci, int) or ci < 0 or ci >= len(options):
                raise HTTPException(status_code=400, detail="Doğru şık geçersiz")
    elif step_type == LessonStepType.explanation:
        if not content.get("title") and not content.get("body"):
            raise HTTPException(status_code=400, detail="Anlatım için başlık veya metin gerekli")
        # Üç pratik modu ayrı listelerde saklanır; hepsi aynı şekilde doğrulanır.
        for key in ("board_exercises", "board_exercises_timed", "board_exercises_test"):
            if key in content:
                _validate_board_exercises(content[key])
        # Alt konu bazlı soru sayısı (madde 3) — havuzdan fazla sayı reddedilir;
        # havuz SONRADAN küçülürse burada bir şey kırılmaz (admin panelinde uyarı gösterilir).
        counts = content.get("question_counts")
        if counts is not None:
            if not isinstance(counts, dict):
                raise HTTPException(status_code=400, detail="question_counts bir nesne olmalı")
            for key, value in counts.items():
                if key not in ("board_exercises", "board_exercises_timed", "board_exercises_test"):
                    raise HTTPException(status_code=400, detail=f"Geçersiz soru sayısı alanı: {key}")
                if not isinstance(value, int) or isinstance(value, bool) or value < 1:
                    raise HTTPException(status_code=400, detail="Soru sayısı 1 veya daha büyük bir tam sayı olmalı")
                pool = content.get(key)
                pool_len = len(pool) if isinstance(pool, list) else 0
                if value > pool_len:
                    raise HTTPException(
                        status_code=400,
                        detail="Soru sayısı havuzdaki soru sayısından fazla olamaz",
                    )


def _step_out(s: LessonStep) -> dict:
    return {"id": s.id, "lesson_id": s.lesson_id, "order_index": s.order_index,
            "type": s.type.value, "content_json": s.content_json,
            "correct_answer_json": s.correct_answer_json}


@router.get("/lessons/{lesson_id}/steps", response_model=list[AdminStepDetail])
async def list_steps(
    lesson_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    steps = (await db.execute(
        select(LessonStep).where(LessonStep.lesson_id == lesson_id).order_by(LessonStep.order_index)
    )).scalars().all()
    return [AdminStepDetail(**_step_out(s)) for s in steps]


@router.post("/lessons/{lesson_id}/steps", status_code=201)
async def create_step(
    lesson_id: int,
    payload: StepCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    try:
        step_type = LessonStepType(payload.type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Geçersiz adım türü: {payload.type}")
    _validate_step_content(step_type, payload.content_json)

    max_order = (await db.execute(
        select(func.max(LessonStep.order_index)).where(LessonStep.lesson_id == lesson_id)
    )).scalar_one_or_none() or 0
    step = LessonStep(lesson_id=lesson_id, order_index=max_order + 1, type=step_type,
                      content_json=payload.content_json,
                      correct_answer_json=payload.correct_answer_json)
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return _step_out(step)


@router.patch("/steps/{step_id}")
async def update_step(
    step_id: int,
    payload: StepUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    step = await db.get(LessonStep, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    if payload.content_json is not None:
        _validate_step_content(step.type, payload.content_json)
        step.content_json = payload.content_json
    if payload.correct_answer_json is not None:
        step.correct_answer_json = payload.correct_answer_json
    if payload.lesson_id is not None and payload.lesson_id != step.lesson_id:
        target = await db.get(Lesson, payload.lesson_id)
        if not target:
            raise HTTPException(status_code=404, detail="Target lesson not found")
        max_order = (await db.execute(
            select(func.max(LessonStep.order_index)).where(LessonStep.lesson_id == payload.lesson_id)
        )).scalar_one_or_none() or 0
        step.lesson_id = payload.lesson_id
        step.order_index = max_order + 1
    await db.commit()
    await db.refresh(step)
    return _step_out(step)


@router.post("/lessons/{lesson_id}/steps/reorder")
async def reorder_steps(
    lesson_id: int,
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    steps = (await db.execute(
        select(LessonStep).where(LessonStep.id.in_(payload.ordered_ids),
                                 LessonStep.lesson_id == lesson_id)
    )).scalars().all()
    by_id = {s.id: s for s in steps}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown step id")
    for i, sid in enumerate(payload.ordered_ids):
        by_id[sid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.delete("/steps/{step_id}")
async def delete_step(
    step_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Adımı ve SADECE o adıma ait deneme/pratik kayıtlarını siler.
    Ders tamamlama ilerlemesi (child_lesson_progress) korunur.

    NOT: child_practice_results.lesson_step_id, lesson_steps'e FK ile bağlı —
    önce o kayıtlar silinmezse adım silme FK ihlaliyle patlar (KURAL #3)."""
    _ensure_admin(current)
    step = await db.get(LessonStep, step_id)
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    results = (await db.execute(
        select(func.count(ChildLessonStepResult.id)).where(
            ChildLessonStepResult.lesson_step_id == step_id
        )
    )).scalar_one()
    await db.execute(
        delete(ChildLessonStepResult).where(ChildLessonStepResult.lesson_step_id == step_id)
    )
    await db.execute(
        delete(ChildPracticeResult).where(ChildPracticeResult.lesson_step_id == step_id)
    )
    await db.delete(step)
    await db.commit()
    return {"deleted": True, "results_deleted": results}


# ---------------------------------------------------------------------------
# Sporcu paneli global ayarları (yazılar, sekmeler, tahta renk/taş)
# ---------------------------------------------------------------------------

_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_PIECE_KEYS = {"wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"}
_DATA_URI = re.compile(r"^data:image/(png|svg\+xml);base64,")
_MAX_PIECE_BYTES = 64 * 1024  # data-URI kaba üst sınır


def _deep_merge(base: dict, incoming: dict) -> dict:
    """incoming'i base üstüne derin birleştirir (dict'ler iç içe, diğerleri override)."""
    out = dict(base)
    for k, v in incoming.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _validate_settings_patch(patch: dict) -> None:
    """Bilinen alanları doğrular. Bilinmeyen üst anahtarlar reddedilmez (esnek JSON)."""
    if not isinstance(patch, dict):
        raise HTTPException(status_code=400, detail="Ayar gövdesi nesne olmalı")
    board = patch.get("board")
    if isinstance(board, dict):
        for key in ("lightSquare", "darkSquare"):
            if key in board and board[key] is not None:
                if not (isinstance(board[key], str) and _HEX_COLOR.match(board[key])):
                    raise HTTPException(status_code=400, detail=f"Geçersiz renk: {key} (#rrggbb bekleniyor)")
        pieces = board.get("pieces")
        if isinstance(pieces, dict):
            for pk, pv in pieces.items():
                if pk not in _PIECE_KEYS:
                    raise HTTPException(status_code=400, detail=f"Geçersiz taş anahtarı: {pk}")
                if pv is None:
                    continue  # varsayılana dön
                if not (isinstance(pv, str) and _DATA_URI.match(pv)):
                    raise HTTPException(status_code=400, detail=f"Taş görseli data-URI (png/svg) olmalı: {pk}")
                if len(pv.encode("utf-8")) > _MAX_PIECE_BYTES:
                    raise HTTPException(status_code=400, detail=f"Taş görseli çok büyük (≤64KB): {pk}")


@router.get("/settings")
async def admin_get_settings(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    row = (await db.execute(select(AppSettings).limit(1))).scalar_one_or_none()
    return row.data if row and isinstance(row.data, dict) else {}


@router.patch("/settings")
async def admin_patch_settings(
    patch: dict = Body(...),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Öğretmen global ayarları kısmen günceller (deep-merge). Sporcuya otomatik yansır."""
    _ensure_admin(current)
    _validate_settings_patch(patch)
    row = (await db.execute(select(AppSettings).limit(1))).scalar_one_or_none()
    if row is None:
        row = AppSettings(data=_deep_merge({}, patch))
        db.add(row)
    else:
        row.data = _deep_merge(row.data or {}, patch)
    await db.commit()
    await db.refresh(row)
    return row.data


# ---------------------------------------------------------------------------
# Acilis pratigi: acilis listesi (Zafer Hoca girer)
# ---------------------------------------------------------------------------

OPENING_CATEGORIES = ("e4", "d4", "diger")


class OpeningCreateRequest(BaseModel):
    name: str
    start_fen: str
    # Eski istemciler gondermez -> "Diğerleri" grubuna duser.
    category: str = "diger"


class OpeningUpdateRequest(BaseModel):
    name: str
    start_fen: str
    # None = "dokunma": eski istemci gondermezse mevcut kategori korunur.
    category: str | None = None


class OpeningMoveRequest(BaseModel):
    direction: str  # 'up' | 'down'


def _validate_category(value: str) -> str:
    if value not in OPENING_CATEGORIES:
        raise HTTPException(status_code=400, detail="Geçersiz açılış türü")
    return value


def _validate_fen(fen: str) -> None:
    """FEN'i python-chess ile dogrular; bozuk pozisyon kaydedilmez."""
    try:
        chess.Board(fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Geçersiz FEN")


@router.post("/openings", status_code=201)
async def create_opening(
    payload: OpeningCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Açılış adı gerekli")
    _validate_fen(payload.start_fen)
    # Yeni acilis listenin SONUNA eklenir (madde 8 siralamasi bozulmasin).
    category = _validate_category(payload.category)
    max_order = (await db.execute(select(func.max(Opening.sort_order)))).scalar() or 0
    op_row = Opening(
        name=name, start_fen=payload.start_fen,
        sort_order=max_order + 1, category=category,
    )
    db.add(op_row)
    await db.commit()
    await db.refresh(op_row)
    return {
        "id": op_row.id, "name": op_row.name,
        "start_fen": op_row.start_fen, "category": op_row.category,
    }


@router.patch("/openings/{opening_id}")
async def update_opening(
    opening_id: int,
    payload: OpeningUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Zafer Hoca'nin daha once eklenmis bir acilisin adini/FEN'ini duzeltmesi
    icin (madde 7). Var olan maclarin start_fen'ini ETKILEMEZ — o deger her
    macta ayrica kopyalanip saklanir."""
    _ensure_admin(current)
    row = await db.get(Opening, opening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Opening not found")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Açılış adı gerekli")
    _validate_fen(payload.start_fen)
    row.name = name
    row.start_fen = payload.start_fen
    if payload.category is not None:
        row.category = _validate_category(payload.category)
    await db.commit()
    await db.refresh(row)
    return {
        "id": row.id, "name": row.name,
        "start_fen": row.start_fen, "category": row.category,
    }


@router.post("/openings/{opening_id}/move")
async def move_opening(
    opening_id: int,
    payload: OpeningMoveRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Acilisi bir komsusuyla YER DEGISTIRIR (madde 8). Listenin ucundaki
    acilis o yonde hareket ettirilmeye calisilirsa sessizce hicbir sey
    yapilmaz — hata degil, zaten en uctadir."""
    _ensure_admin(current)
    if payload.direction not in ("up", "down"):
        raise HTTPException(status_code=400, detail="direction 'up' veya 'down' olmalı")
    row = await db.get(Opening, opening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Opening not found")

    all_rows = (await db.execute(
        select(Opening).order_by(Opening.sort_order, Opening.id)
    )).scalars().all()
    idx = next((i for i, r in enumerate(all_rows) if r.id == opening_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Opening not found")

    neighbor_idx = idx - 1 if payload.direction == "up" else idx + 1
    if neighbor_idx < 0 or neighbor_idx >= len(all_rows):
        return {"moved": False}

    neighbor = all_rows[neighbor_idx]
    row.sort_order, neighbor.sort_order = neighbor.sort_order, row.sort_order
    await db.commit()
    return {"moved": True}


@router.delete("/openings/{opening_id}")
async def delete_opening(
    opening_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    row = await db.get(Opening, opening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Opening not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": True}


class PoolImageCreateRequest(BaseModel):
    category: str
    data_uri: str


@router.post("/pool-images")
async def add_pool_image(
    payload: PoolImageCreateRequest,
    response: Response,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Görseli havuza ekler. Aynı kategoride aynı bayt dizisi zaten varsa YENİ
    satır eklenmez, mevcut kayıt döner (created=False).

    Dedup birebir bayt eslesmesidir; gorsel benzerligi tespiti YOKTUR (spec).
    """
    _ensure_admin(current)
    if payload.category not in POOL_CATEGORIES:
        raise HTTPException(status_code=400, detail="Geçersiz kategori")
    _check_data_uri_size(payload.data_uri, "Havuz görseli")

    existing = (
        await db.execute(
            select(PoolImage).where(
                PoolImage.category == payload.category,
                PoolImage.data_uri == payload.data_uri,
            )
        )
    ).scalars().first()
    if existing:
        return {"id": existing.id, "category": existing.category, "created": False}

    row = PoolImage(category=payload.category, data_uri=payload.data_uri)
    db.add(row)
    await db.commit()
    response.status_code = 201
    return {"id": row.id, "category": row.category, "created": True}


@router.delete("/pool-images/{image_id}")
async def delete_pool_image(
    image_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Görseli havuzdan siler.

    Bu islem mevcut sorulari BOZMAZ: soru kaydedilirken gorselin data-URI'si
    sorunun kendi JSON'ina kopyalanir, havuz id'si referans tutulmaz. Silme
    yalnizca "bu gorsel bundan sonra secilemez" anlamina gelir.
    """
    _ensure_admin(current)
    row = await db.get(PoolImage, image_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pool image not found")
    await db.delete(row)
    await db.commit()
    return {"deleted": True}


CUSTOM_TAB_EMOJIS = ["📌", "⭐", "🎯", "📢", "🗂️", "🧭", "💡", "🔔"]


class CustomTabCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    # Verilmezse eski davranış: CUSTOM_TAB_EMOJIS'ten sırayla atanır
    # (madde 3, 2026-08-19: admin artık ikon havuzundan seçebilir).
    emoji: str | None = Field(default=None, max_length=10)

    @field_validator("label")
    @classmethod
    def _label_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Sekme adı boş olamaz")
        return v


class CustomTabUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=60)
    emoji: str | None = Field(default=None, max_length=10)


class CustomTabSectionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = ""
    images: list[str] = []
    emoji: str | None = Field(default=None, max_length=10)


class PracticePosition(BaseModel):
    id: str = Field(min_length=1)
    fen: str = Field(min_length=1)
    # Oyunsonu Pratiği'nde konumlar 5 kategoriye ayrılır. Kategorisiz kayıt da
    # geçerlidir — eski konumlarda bu alan yok (KURAL #3).
    category: str | None = None
    # Sporcuya ve hocaya gösterilen kalıcı numara ("001"). Eski konumlarda yok;
    # o durumda ekran tarafı sıraya göre tutarlı bir kod üretir.
    code: str | None = None


class CustomTabSectionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = None
    images: list[str] | None = None
    practice_positions: list[PracticePosition] | None = None
    emoji: str | None = Field(default=None, max_length=10)


@router.post("/custom-tabs", status_code=201)
async def create_custom_tab(
    payload: CustomTabCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    count = (await db.execute(select(func.count(CustomTab.id)))).scalar_one()
    max_order = (await db.execute(select(func.max(CustomTab.order_index)))).scalar_one_or_none() or 0
    tab = CustomTab(
        order_index=max_order + 1, label=payload.label,
        emoji=payload.emoji or CUSTOM_TAB_EMOJIS[count % len(CUSTOM_TAB_EMOJIS)],
    )
    db.add(tab)
    await db.commit()
    await db.refresh(tab)
    return {"id": tab.id, "order_index": tab.order_index, "label": tab.label, "emoji": tab.emoji}


@router.patch("/custom-tabs/{tab_id}")
async def update_custom_tab(
    tab_id: int,
    payload: CustomTabUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Madde 1/3 (2026-08-19): admin sekmenin adını VE ikonunu (ikon
    havuzundan) değiştirebilsin diye — eskiden PATCH hiç yoktu."""
    _ensure_admin(current)
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    if payload.label is not None:
        tab.label = payload.label
    if payload.emoji is not None:
        tab.emoji = payload.emoji
    await db.commit()
    await db.refresh(tab)
    return {"id": tab.id, "order_index": tab.order_index, "label": tab.label, "emoji": tab.emoji}


@router.delete("/custom-tabs/{tab_id}")
async def delete_custom_tab(
    tab_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sekmeyi ve tüm bölümlerini siler. Sporcu ilerlemesi bu tabloya bağlı
    olmadığı için (yalnızca içerik metni), engelsiz cascade güvenlidir."""
    _ensure_admin(current)
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    await db.execute(delete(CustomTabSection).where(CustomTabSection.custom_tab_id == tab_id))
    await db.delete(tab)
    await db.commit()
    return {"deleted": True}


@router.post("/custom-tabs/reorder")
async def reorder_custom_tabs(
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    tabs = (await db.execute(
        select(CustomTab).where(CustomTab.id.in_(payload.ordered_ids))
    )).scalars().all()
    by_id = {t.id: t for t in tabs}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown custom tab id")
    for i, tid in enumerate(payload.ordered_ids):
        by_id[tid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


@router.post("/custom-tabs/{tab_id}/sections", status_code=201)
async def create_custom_tab_section(
    tab_id: int,
    payload: CustomTabSectionCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    for i, img in enumerate(payload.images):
        _check_data_uri_size(img, f"{i + 1}. görsel")
    max_order = (await db.execute(
        select(func.max(CustomTabSection.order_index)).where(CustomTabSection.custom_tab_id == tab_id)
    )).scalar_one_or_none() or 0
    section = CustomTabSection(
        custom_tab_id=tab_id, order_index=max_order + 1,
        title=payload.title, body=payload.body, images=payload.images,
        emoji=payload.emoji,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return {"id": section.id, "order_index": section.order_index, "title": section.title,
            "body": section.body, "images": section.images,
            "practice_positions": section.practice_positions, "emoji": section.emoji}


@router.patch("/custom-tab-sections/{section_id}")
async def update_custom_tab_section(
    section_id: int,
    payload: CustomTabSectionUpdateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    section = await db.get(CustomTabSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    if payload.title is not None:
        section.title = payload.title
    if payload.body is not None:
        section.body = payload.body
    if payload.images is not None:
        for i, img in enumerate(payload.images):
            _check_data_uri_size(img, f"{i + 1}. görsel")
        section.images = payload.images
    if payload.practice_positions is not None:
        section.practice_positions = [p.model_dump() for p in payload.practice_positions]
    if payload.emoji is not None:
        section.emoji = payload.emoji
    await db.commit()
    await db.refresh(section)
    return {"id": section.id, "order_index": section.order_index, "title": section.title,
            "body": section.body, "images": section.images,
            "practice_positions": section.practice_positions, "emoji": section.emoji}


@router.delete("/custom-tab-sections/{section_id}")
async def delete_custom_tab_section(
    section_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    section = await db.get(CustomTabSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.commit()
    return {"deleted": True}


@router.post("/custom-tabs/{tab_id}/sections/reorder")
async def reorder_custom_tab_sections(
    tab_id: int,
    payload: ReorderRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    sections = (await db.execute(
        select(CustomTabSection).where(
            CustomTabSection.id.in_(payload.ordered_ids),
            CustomTabSection.custom_tab_id == tab_id,
        )
    )).scalars().all()
    by_id = {s.id: s for s in sections}
    if len(by_id) != len(payload.ordered_ids):
        raise HTTPException(status_code=400, detail="Unknown section id")
    for i, sid in enumerate(payload.ordered_ids):
        by_id[sid].order_index = i + 1
    await db.commit()
    return {"reordered": len(payload.ordered_ids)}


# ── Turnuvalar (madde: "Turnuvaya Katıl" — Admin/hoca oluşturur, İsviçre
# usulü basitleştirilmiş eşleştirme, uçtan uca temel akış). Erişim: yalnızca
# oluşturan hoca kendi turnuvalarını yönetir (athletes.py'deki "aynı hoca"
# gizlilik deseniyle AYNI mantık).

def _tournament_out(t: Tournament) -> dict:
    return {
        "id": t.id, "name": t.name, "rounds_total": t.rounds_total,
        "base_ms": t.base_ms, "increment_ms": t.increment_ms,
        "status": t.status.value, "current_round": t.current_round,
    }


@router.post("/tournaments", status_code=201)
async def create_tournament(
    payload: TournamentCreateRequest,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    t = Tournament(
        name=payload.name, created_by_user_id=current.id,
        rounds_total=payload.rounds_total,
        base_ms=payload.base_ms, increment_ms=payload.increment_ms,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _tournament_out(t)


@router.get("/tournaments")
async def list_tournaments_admin(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    rows = (await db.execute(
        select(Tournament).where(Tournament.created_by_user_id == current.id)
        .order_by(Tournament.created_at.desc())
    )).scalars().all()
    return [_tournament_out(t) for t in rows]


async def _tournament_or_404(db: AsyncSession, tournament_id: int, current: User) -> Tournament:
    t = await db.get(Tournament, tournament_id)
    if not t or t.created_by_user_id != current.id:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


async def _standings(db: AsyncSession, tournament_id: int) -> list[dict]:
    rows = (await db.execute(
        select(TournamentParticipant, ChildProfile.display_name)
        .join(ChildProfile, ChildProfile.id == TournamentParticipant.child_id)
        .where(TournamentParticipant.tournament_id == tournament_id)
        .order_by(TournamentParticipant.score.desc(), TournamentParticipant.id)
    )).all()
    return [
        {"child_id": p.child_id, "display_name": name, "score": p.score}
        for p, name in rows
    ]


async def _pairings_by_round(db: AsyncSession, tournament_id: int) -> dict[int, list[dict]]:
    rows = (await db.execute(
        select(TournamentPairing, ChildProfile.display_name)
        .join(ChildProfile, ChildProfile.id == TournamentPairing.white_child_id)
        .where(TournamentPairing.tournament_id == tournament_id)
        .order_by(TournamentPairing.round_number, TournamentPairing.id)
    )).all()
    # Siyah isimlerini ayrı çekmek gerekiyor (LEFT JOIN yerine iki sorgu —
    # bay geçmede black_child_id NULL olabilir).
    black_ids = [p.black_child_id for p, _ in rows if p.black_child_id is not None]
    black_names: dict[int, str] = {}
    if black_ids:
        black_rows = (await db.execute(
            select(ChildProfile.id, ChildProfile.display_name).where(ChildProfile.id.in_(black_ids))
        )).all()
        black_names = {cid: name for cid, name in black_rows}
    out: dict[int, list[dict]] = {}
    for p, white_name in rows:
        out.setdefault(p.round_number, []).append({
            "id": p.id,
            "white_child_id": p.white_child_id, "white_name": white_name,
            "black_child_id": p.black_child_id,
            "black_name": black_names.get(p.black_child_id) if p.black_child_id else None,
            "game_id": p.game_id, "result": p.result,
        })
    return out


@router.get("/tournaments/{tournament_id}")
async def get_tournament_admin(
    tournament_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    t = await _tournament_or_404(db, tournament_id, current)
    return {
        **_tournament_out(t),
        "standings": await _standings(db, tournament_id),
        "pairings_by_round": await _pairings_by_round(db, tournament_id),
    }


@router.post("/tournaments/{tournament_id}/start")
async def start_tournament(
    tournament_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    t = await _tournament_or_404(db, tournament_id, current)
    if t.status != TournamentStatus.upcoming:
        raise HTTPException(status_code=400, detail="Turnuva zaten başladı")
    count = (await db.execute(
        select(func.count(TournamentParticipant.id)).where(TournamentParticipant.tournament_id == tournament_id)
    )).scalar_one()
    if count < 2:
        raise HTTPException(status_code=400, detail="En az 2 katılımcı gerekli")
    t.status = TournamentStatus.active
    t.current_round = 1
    t.started_at = datetime.utcnow()
    await generate_pairings(db, tournament_id, 1)
    await db.commit()
    await db.refresh(t)
    return {
        **_tournament_out(t),
        "standings": await _standings(db, tournament_id),
        "pairings_by_round": await _pairings_by_round(db, tournament_id),
    }


@router.post("/tournaments/{tournament_id}/next-round")
async def advance_tournament_round(
    tournament_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mevcut turun TÜM eşleşmeleri sonuçlanınca çağrılır. Son turdaysa
    turnuvayı bitirir; değilse bir sonraki turun eşleşmelerini üretir.

    Eşzamanlı çift-tıklamaya karşı: current_round üzerinde KOŞULLU UPDATE
    ile "hakkı" önce kazanılır (etkilenen satır 0 ise 409) — iki istek
    aynı anda gelirse yalnızca biri turu ilerletebilir.
    """
    _ensure_admin(current)
    t = await _tournament_or_404(db, tournament_id, current)
    if t.status != TournamentStatus.active or t.current_round is None:
        raise HTTPException(status_code=400, detail="Turnuva aktif değil")
    unresolved = (await db.execute(
        select(func.count(TournamentPairing.id)).where(
            TournamentPairing.tournament_id == tournament_id,
            TournamentPairing.round_number == t.current_round,
            TournamentPairing.result.is_(None),
        )
    )).scalar_one()
    if unresolved > 0:
        raise HTTPException(status_code=400, detail=f"Bu turda {unresolved} eşleşme henüz sonuçlanmadı")

    this_round = t.current_round
    if this_round >= t.rounds_total:
        claim = await db.execute(
            update(Tournament)
            .where(Tournament.id == tournament_id, Tournament.current_round == this_round,
                   Tournament.status == TournamentStatus.active)
            .values(status=TournamentStatus.finished, finished_at=datetime.utcnow())
        )
        if claim.rowcount == 0:
            raise HTTPException(status_code=409, detail="Turnuva zaten güncellendi, sayfayı yenile")
    else:
        claim = await db.execute(
            update(Tournament)
            .where(Tournament.id == tournament_id, Tournament.current_round == this_round,
                   Tournament.status == TournamentStatus.active)
            .values(current_round=this_round + 1)
        )
        if claim.rowcount == 0:
            raise HTTPException(status_code=409, detail="Turnuva zaten güncellendi, sayfayı yenile")
        await generate_pairings(db, tournament_id, this_round + 1)
    await db.commit()
    await db.refresh(t)
    return {
        **_tournament_out(t),
        "standings": await _standings(db, tournament_id),
        "pairings_by_round": await _pairings_by_round(db, tournament_id),
    }


@router.delete("/tournaments/{tournament_id}")
async def delete_tournament(
    tournament_id: int,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_admin(current)
    t = await _tournament_or_404(db, tournament_id, current)
    await db.execute(delete(TournamentPairing).where(TournamentPairing.tournament_id == tournament_id))
    await db.execute(delete(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id))
    await db.delete(t)
    await db.commit()
    return {"deleted": True}
