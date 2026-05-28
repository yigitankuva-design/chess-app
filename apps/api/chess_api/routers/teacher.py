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
from pydantic import BaseModel, Field

_ALPHABET = string.ascii_uppercase + string.digits


class CreateClassRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class CreateAssignmentRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = None
    target_module_id: int | None = None
    target_lesson_id: int | None = None
    due_date: str | None = None  # ISO date string


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
    """Search children by display_name (no class filter needed — teacher can add any child)."""
    _ensure_teacher(current)
    stmt = select(ChildProfile)
    if q.strip():
        stmt = stmt.where(ChildProfile.display_name.ilike(f"%{q.strip()}%"))
    stmt = stmt.limit(20)
    result = await db.execute(stmt)
    return [
        {"id": c.id, "display_name": c.display_name, "avatar": c.avatar, "class_id": c.class_id}
        for c in result.scalars().all()
    ]


@router.post("/classes/{class_id}/students/{child_id}", status_code=200)
async def add_student(
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
    if not child:
        raise HTTPException(404, "Child not found")
    if child.class_id is not None and child.class_id != class_id:
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
    assignment = ClassAssignment(
        class_id=class_id,
        title=payload.title,
        description=payload.description,
        target_module_id=payload.target_module_id,
        target_lesson_id=payload.target_lesson_id,
        due_date=date_type.fromisoformat(payload.due_date) if payload.due_date else None,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return {"id": assignment.id}


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
