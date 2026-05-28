from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from chess_api.database import get_db
from chess_api.models import (
    Module, Lesson, LessonStep, ChildLessonStepResult,
)
from chess_api.schemas.lesson import (
    ModuleResponse, LessonDetailResponse, LessonStepResponse,
    StepAnswerRequest, StepAnswerResponse,
)

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
        select(Lesson).where(Lesson.module_id == module_id).order_by(Lesson.order_index)
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
