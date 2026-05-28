"""Deterministic puzzle-of-the-day.

Picks the same puzzle for everyone on a given UTC date, from a kid-friendly
rating band (700-1000). Uses an md5 hash of the date to index into the
ordered candidate list, so it's stable within a day and rotates daily.
"""
import hashlib
from datetime import date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from chess_api.models import Puzzle


async def todays_puzzle(db: AsyncSession, today: date | None = None) -> Puzzle | None:
    """Select today's puzzle deterministically based on date.

    Args:
        db: Database session
        today: Override date (for testing). Defaults to today.

    Returns:
        Puzzle instance or None if no suitable puzzles exist.
    """
    today = today or date.today()
    candidates = (await db.execute(
        select(Puzzle)
        .where(Puzzle.rating >= 700, Puzzle.rating <= 1000)
        .order_by(Puzzle.id)
        .options(selectinload(Puzzle.themes))
    )).scalars().all()
    if not candidates:
        return None
    h = int(hashlib.md5(today.isoformat().encode()).hexdigest()[:8], 16)
    return candidates[h % len(candidates)]
