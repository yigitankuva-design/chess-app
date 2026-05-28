from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import ChildActivityLog


async def log_activity(
    db: AsyncSession,
    child_id: int,
    time_seconds: int = 0,
    lessons: int = 0,
    puzzles: int = 0,
    games: int = 0,
) -> None:
    """Upsert today's activity totals for a child. Caller commits."""
    today = date.today()
    result = await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child_id,
            ChildActivityLog.date == today,
        )
    )
    log = result.scalar_one_or_none()
    if log:
        log.total_seconds += time_seconds
        log.lessons_completed += lessons
        log.puzzles_solved += puzzles
        log.games_played += games
    else:
        db.add(ChildActivityLog(
            child_id=child_id, date=today, total_seconds=time_seconds,
            lessons_completed=lessons, puzzles_solved=puzzles, games_played=games,
        ))
    await db.commit()
