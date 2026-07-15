from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import (
    Module, Lesson, LessonStep, ChildLessonStepResult,
    ChildProfile, ChildLessonProgress, LessonStatus,
)
from chess_api.schemas.lesson import (
    ModuleResponse, LessonDetailResponse, LessonStepResponse,
    StepAnswerRequest, StepAnswerResponse,
)
from chess_api.services.activity_logger import log_activity
from chess_api.services.rank_engine import add_xp
from chess_api.services.badge_engine import evaluate_event, BadgeEvent

router = APIRouter(tags=["lessons"])


@router.get("/modules", response_model=list[ModuleResponse])
async def list_modules(db: AsyncSession = Depends(get_db)):
    modules = (await db.execute(select(Module).order_by(Module.order_index))).scalars().all()
    result = []
    for m in modules:
        count = await db.scalar(
            select(func.count(Lesson.id)).where(Lesson.module_id == m.id)
        )
        result.append(ModuleResponse(
            id=m.id, order_index=m.order_index, name=m.name,
            description=m.description, icon=m.icon, lessons_count=count or 0,
        ))
    return result


@router.get("/modules/{module_id}/lessons", response_model=list[dict])
async def module_lessons(module_id: int, db: AsyncSession = Depends(get_db)):
    lessons = (await db.execute(
        select(Lesson)
        .where(Lesson.module_id == module_id, Lesson.published.is_(True))
        .order_by(Lesson.order_index)
    )).scalars().all()
    return [
        {"id": l.id, "order_index": l.order_index, "title": l.title,
         "estimated_minutes": l.estimated_minutes}
        for l in lessons
    ]


@router.get("/lessons/{lesson_id}", response_model=LessonDetailResponse)
async def get_lesson(lesson_id: int, db: AsyncSession = Depends(get_db)):
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    steps = (await db.execute(
        select(LessonStep)
        .where(LessonStep.lesson_id == lesson_id)
        .order_by(LessonStep.order_index)
    )).scalars().all()
    return LessonDetailResponse(
        id=lesson.id, module_id=lesson.module_id, title=lesson.title,
        estimated_minutes=lesson.estimated_minutes,
        steps=[
            LessonStepResponse(
                id=s.id, order_index=s.order_index, type=s.type,
                content_json=s.content_json,
            ) for s in steps
        ],
    )


@router.post("/lessons/{lesson_id}/step/{step_id}/answer",
             response_model=StepAnswerResponse)
async def submit_step_answer(
    lesson_id: int,
    step_id: int,
    payload: StepAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    step = await db.get(LessonStep, step_id)
    if not step or step.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Step not found")

    expected = step.correct_answer_json or {}
    is_correct = (
        all(payload.answer_json.get(k) == v for k, v in expected.items())
        if expected else True
    )

    next_step = await db.execute(
        select(LessonStep)
        .where(LessonStep.lesson_id == lesson_id, LessonStep.order_index > step.order_index)
        .order_by(LessonStep.order_index)
        .limit(1)
    )
    next_obj = next_step.scalar_one_or_none()
    return StepAnswerResponse(
        correct=is_correct,
        next_step_index=next_obj.order_index if next_obj else None,
        lesson_completed=next_obj is None and is_correct,
    )


@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Upsert progress
    existing = await db.execute(
        select(ChildLessonProgress).where(
            ChildLessonProgress.child_id == child.id,
            ChildLessonProgress.lesson_id == lesson_id,
        )
    )
    progress = existing.scalar_one_or_none()
    newly_completed = False
    if progress:
        if progress.status != LessonStatus.completed:
            progress.status = LessonStatus.completed
            progress.completed_at = datetime.utcnow()
            newly_completed = True
    else:
        progress = ChildLessonProgress(
            child_id=child.id, lesson_id=lesson_id,
            status=LessonStatus.completed, completed_at=datetime.utcnow(),
        )
        db.add(progress)
        newly_completed = True
    await db.commit()

    awarded = {"new_badges": [], "xp": None}
    if newly_completed:
        await log_activity(db, child.id, lessons=1)
        xp = await add_xp(db, child.id, "lesson_completed")
        new_badges = await evaluate_event(db, child.id, BadgeEvent(type="lessons_completed"))
        # module_completed badge: check if ALL lessons in this module are now completed
        module_done_badges = await _check_module_completion(db, child.id, lesson.module_id)
        awarded = {
            "new_badges": [b.slug for b in (new_badges + module_done_badges)],
            "xp": xp,
        }
    return {"completed": True, "newly_completed": newly_completed, **awarded}


async def _check_module_completion(db, child_id, module_id):
    """If all lessons in module are completed by child, fire module_completed event."""
    total = await db.scalar(select(func.count(Lesson.id)).where(Lesson.module_id == module_id))
    done = await db.scalar(
        select(func.count(ChildLessonProgress.id))
        .join(Lesson, Lesson.id == ChildLessonProgress.lesson_id)
        .where(Lesson.module_id == module_id, ChildLessonProgress.child_id == child_id,
               ChildLessonProgress.status == LessonStatus.completed)
    )
    if total and done and total == done:
        # find module order_index
        module = await db.get(Module, module_id)
        order = module.order_index if module else None
        return await evaluate_event(db, child_id, BadgeEvent(type="module_completed", module_order=order))
    return []
