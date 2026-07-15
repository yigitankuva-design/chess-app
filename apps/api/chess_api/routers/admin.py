from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models import User, UserRole, ChildProfile, ParentSurveyResponse, Device
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
)

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
        count = (await db.execute(
            select(func.count(ChildProfile.id)).where(ChildProfile.parent_user_id == p.id)
        )).scalar_one()
        out.append(AdminParentSummary(
            id=p.id, name=p.name, email=p.email,
            created_at=p.created_at, child_count=count,
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


@router.get("/modules/{module_id}/lessons", response_model=list[AdminLessonSummary])
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
        out.append(AdminLessonSummary(
            id=les.id, order_index=les.order_index, title=les.title,
            estimated_minutes=les.estimated_minutes, step_count=sc,
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
