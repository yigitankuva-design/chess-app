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
    play_seconds: int = 0,
    lessons_seconds: int = 0,
    practice_seconds: int = 0,
) -> None:
    """Upsert today's activity totals for a child. Caller commits.

    Madde 2026-09-06: play_seconds/lessons_seconds/practice_seconds — Sporcu
    Profili "Bu Hafta" kartının Maç Yap/Dersler/Pratik Yap ayrımı için.
    Hepsi AYRICA total_seconds'a da eklenir (eski günlük limit kontrolü hâlâ
    total_seconds'a bakıyor — geriye uyumluluk, KURAL #3).
    """
    today = date.today()
    category_seconds = play_seconds + lessons_seconds + practice_seconds
    combined_time = time_seconds + category_seconds
    result = await db.execute(
        select(ChildActivityLog).where(
            ChildActivityLog.child_id == child_id,
            ChildActivityLog.date == today,
        )
    )
    log = result.scalar_one_or_none()
    if log:
        log.total_seconds += combined_time
        log.lessons_completed += lessons
        log.puzzles_solved += puzzles
        log.games_played += games
        log.play_seconds += play_seconds
        log.lessons_seconds += lessons_seconds
        log.practice_seconds += practice_seconds
    else:
        db.add(ChildActivityLog(
            child_id=child_id, date=today, total_seconds=combined_time,
            lessons_completed=lessons, puzzles_solved=puzzles, games_played=games,
            play_seconds=play_seconds, lessons_seconds=lessons_seconds,
            practice_seconds=practice_seconds,
        ))
    await db.commit()
