from datetime import datetime
import chess
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select, func, delete
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
            id=m.id, order_index=m.order_index, name=m.name, lesson_count=lc,
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
            "published": les.published, "step_count": step_count}


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
                    estimated_minutes=payload.estimated_minutes, published=False)
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
    if step_ids:
        results = (await db.execute(
            select(func.count(ChildLessonStepResult.id)).where(
                ChildLessonStepResult.lesson_step_id.in_(step_ids)
            )
        )).scalar_one()
    if prog or results:
        raise HTTPException(
            status_code=409,
            detail="Bu derse ait çocuk ilerlemesi var. Silmek yerine yayından kaldırabilirsiniz.",
        )

    await db.execute(delete(LessonStep).where(LessonStep.lesson_id == lesson_id))
    await db.delete(lesson)
    await db.commit()
    return {"deleted": True}


BOARD_EXERCISE_TYPES = ("click_square", "move_piece", "identify_piece")
MAX_EXERCISE_IMAGE_BYTES = 400_000


def _check_data_uri_size(value: object, field_label: str) -> None:
    """data-URI'nin gerçek bayt boyutunu kontrol eder (tarayıcı sıkıştırmasının ikinci savunma hattı)."""
    if not isinstance(value, str) or not value.startswith("data:image/"):
        raise HTTPException(status_code=400, detail=f"{field_label} geçerli bir görsel değil")
    if len(value.encode("utf-8")) > MAX_EXERCISE_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail=f"{field_label} çok büyük (en fazla 400KB)")


CHOICE_EXERCISE_TYPES = ("sentence_question", "image_question")


def _validate_choice_exercise(ex: dict, ex_type: str) -> None:
    """sentence_question / image_question doğrulaması — tahtaya bağımlı değil."""
    if ex_type == "image_question":
        img = ex.get("prompt_image")
        if not img:
            raise HTTPException(status_code=400, detail="Görsel soru için görsel gerekli")
        _check_data_uri_size(img, "Soru görseli")
    else:  # sentence_question
        if not (ex.get("instruction") or "").strip():
            raise HTTPException(status_code=400, detail="Cümle sorusu için soru metni gerekli")

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

        elif ex_type == "move_piece":
            piece_sq = ex.get("piece_square")
            if piece_sq not in chess.SQUARE_NAMES:
                raise HTTPException(status_code=400, detail=f"Geçersiz taş karesi: {piece_sq}")
            if board.piece_at(chess.parse_square(piece_sq)) is None:
                raise HTTPException(status_code=400, detail=f"{piece_sq} karesinde taş yok")
            for target in _squares("target_squares"):
                move = chess.Move.from_uci(piece_sq + target)
                if move not in board.legal_moves:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{piece_sq}{target} bu pozisyonda kurallara uygun değil "
                               f"(terfi içeren hamleler desteklenmiyor)",
                    )

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
    """Adımı ve SADECE o adıma ait deneme kayıtlarını siler.
    Ders tamamlama ilerlemesi (child_lesson_progress) korunur."""
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
