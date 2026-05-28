from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import (
    User, UserRole, ChildProfile, ChildActivityLog, ChildLessonProgress, LessonStatus,
    ChildBadge, ChildRank, Rank, ParentTimeLimit,
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
