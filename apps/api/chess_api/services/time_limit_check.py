from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import ParentTimeLimit, ChildActivityLog


async def check_time_limit(db: AsyncSession, child_id: int) -> dict:
    """Returns {'allowed': bool, 'used_minutes': int, 'limit_minutes': int|None}."""
    limit_row = (await db.execute(
        select(ParentTimeLimit).where(ParentTimeLimit.child_id == child_id)
    )).scalar_one_or_none()
    if not limit_row:
        return {"allowed": True, "used_minutes": 0, "limit_minutes": None}

    today_log = (await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child_id,
            ChildActivityLog.date == date.today(),
        )
    )).scalar_one_or_none()
    used_minutes = (today_log.total_seconds // 60) if today_log else 0
    return {
        "allowed": used_minutes < limit_row.daily_minutes_limit,
        "used_minutes": used_minutes,
        "limit_minutes": limit_row.daily_minutes_limit,
    }
