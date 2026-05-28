from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import (
    User, UserRole, ChildProfile, ChildActivityLog, ChildLessonProgress, LessonStatus,
    ChildBadge, ChildRank, Rank, ParentTimeLimit, ParentSurvey, ParentSurveyResponse, Class,
)

router = APIRouter(prefix="/parent", tags=["parent"])


def _ensure_parent(user: User):
    if user.role != UserRole.parent:
        raise HTTPException(status_code=403, detail="Parents only")


async def _own_child(db: AsyncSession, parent: User, child_id: int) -> ChildProfile:
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != parent.id:
        raise HTTPException(status_code=403, detail="Not your child")
    return child


class TimeLimitRequest(BaseModel):
    daily_minutes: int


class SurveyResponseRequest(BaseModel):
    answers: dict
    child_id: int | None = None


@router.get("/children")
async def list_children(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _ensure_parent(current)
    rows = (await db.execute(
        select(ChildProfile).where(ChildProfile.parent_user_id == current.id)
    )).scalars().all()
    return [
        {"id": c.id, "display_name": c.display_name, "age": c.age, "avatar": c.avatar}
        for c in rows
    ]


@router.get("/children/{child_id}/summary")
async def child_summary(child_id: int, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _ensure_parent(current)
    child = await _own_child(db, current, child_id)

    seven_days_ago = date.today() - timedelta(days=7)
    logs = (await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child_id,
            ChildActivityLog.date >= seven_days_ago,
        ).order_by(ChildActivityLog.date)
    )).scalars().all()

    lessons_completed = await db.scalar(
        select(func.count(ChildLessonProgress.id)).where(
            ChildLessonProgress.child_id == child_id,
            ChildLessonProgress.status == LessonStatus.completed,
        )
    )
    badges_earned = await db.scalar(
        select(func.count(ChildBadge.id)).where(ChildBadge.child_id == child_id)
    )
    cr = (await db.execute(select(ChildRank).where(ChildRank.child_id == child_id))).scalar_one_or_none()
    rank_name = "Piyon"
    xp_total = 0
    if cr:
        rank = await db.get(Rank, cr.current_rank_id)
        rank_name = rank.name_tr if rank else "Piyon"
        xp_total = cr.xp_total

    limit_row = (await db.execute(
        select(ParentTimeLimit).where(ParentTimeLimit.child_id == child_id)
    )).scalar_one_or_none()

    return {
        "child_id": child_id,
        "display_name": child.display_name,
        "avatar": child.avatar,
        "age": child.age,
        "lessons_completed": lessons_completed or 0,
        "badges_earned": badges_earned or 0,
        "rank_name": rank_name,
        "xp_total": xp_total,
        "daily_minutes_limit": limit_row.daily_minutes_limit if limit_row else None,
        "activity_7days": [
            {
                "date": log.date.isoformat(),
                "minutes": log.total_seconds // 60,
                "lessons": log.lessons_completed,
                "puzzles": log.puzzles_solved,
                "games": log.games_played,
            }
            for log in logs
        ],
    }


@router.post("/children/{child_id}/time-limit")
async def set_time_limit(
    child_id: int, payload: TimeLimitRequest,
    current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    await _own_child(db, current, child_id)
    existing = (await db.execute(
        select(ParentTimeLimit).where(ParentTimeLimit.child_id == child_id)
    )).scalar_one_or_none()
    if existing:
        existing.daily_minutes_limit = payload.daily_minutes
    else:
        db.add(ParentTimeLimit(child_id=child_id, daily_minutes_limit=payload.daily_minutes))
    await db.commit()
    return {"daily_minutes": payload.daily_minutes}


@router.get("/surveys")
async def list_surveys(current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List all surveys (V1: global; class-targeting filtering arrives in Plan 8).

    Excludes surveys this parent already responded to.
    """
    _ensure_parent(current)
    responded = (await db.execute(
        select(ParentSurveyResponse.survey_id).where(ParentSurveyResponse.parent_user_id == current.id)
    )).scalars().all()
    responded_ids = set(responded)
    surveys = (await db.execute(select(ParentSurvey))).scalars().all()
    return [
        {"id": s.id, "title": s.title, "questions": s.questions_json}
        for s in surveys if s.id not in responded_ids
    ]


@router.post("/surveys/{survey_id}/respond")
async def respond_survey(
    survey_id: int, payload: SurveyResponseRequest,
    current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    survey = await db.get(ParentSurvey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    # prevent duplicate response
    existing = (await db.execute(
        select(ParentSurveyResponse).where(
            ParentSurveyResponse.survey_id == survey_id,
            ParentSurveyResponse.parent_user_id == current.id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already responded")
    db.add(ParentSurveyResponse(
        survey_id=survey_id, parent_user_id=current.id,
        child_id=payload.child_id, answers_json=payload.answers,
    ))
    await db.commit()
    return {"submitted": True}


@router.post("/children/{child_id}/join-class")
async def join_class(
    child_id: int,
    join_code: str,
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ensure_parent(current)
    child = await db.get(ChildProfile, child_id)
    if not child or child.parent_user_id != current.id:
        raise HTTPException(403)
    cls_q = await db.execute(select(Class).where(Class.join_code == join_code.upper()))
    cls = cls_q.scalar_one_or_none()
    if not cls:
        raise HTTPException(404, "Class not found")
    child.class_id = cls.id
    child.teacher_user_id = cls.teacher_user_id
    await db.commit()
    return {"joined": True, "class_name": cls.name}
