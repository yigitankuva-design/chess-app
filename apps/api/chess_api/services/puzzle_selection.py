import random
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Puzzle, ChildPuzzleAttempt


async def select_puzzle_for_child(
    db: AsyncSession,
    child_id: int,
    child_rating: int = 800,
    module_id: int | None = None,
) -> Puzzle | None:
    """Pick a puzzle within +/-150 of child rating, avoiding recently-attempted ones."""
    rating_low = max(400, child_rating - 150)
    rating_high = min(1400, child_rating + 150)

    recent_q = (
        select(ChildPuzzleAttempt.puzzle_id)
        .where(ChildPuzzleAttempt.child_id == child_id)
        .order_by(ChildPuzzleAttempt.attempted_at.desc())
        .limit(50)
    )
    recent_ids = list((await db.execute(recent_q)).scalars().all())

    filters = [Puzzle.rating >= rating_low, Puzzle.rating <= rating_high]
    if module_id:
        filters.append(Puzzle.module_id == module_id)
    if recent_ids:
        filters.append(Puzzle.id.notin_(recent_ids))

    q = (
        select(Puzzle)
        .where(and_(*filters))
        .options(selectinload(Puzzle.themes))
        .order_by(Puzzle.popularity.desc())
        .limit(30)
    )
    candidates = list((await db.execute(q)).scalars().all())
    if not candidates:
        # Relax: drop module filter if nothing found
        relaxed = [Puzzle.rating >= rating_low, Puzzle.rating <= rating_high]
        if recent_ids:
            relaxed.append(Puzzle.id.notin_(recent_ids))
        q2 = (
            select(Puzzle)
            .where(and_(*relaxed))
            .options(selectinload(Puzzle.themes))
            .order_by(Puzzle.popularity.desc())
            .limit(30)
        )
        candidates = list((await db.execute(q2)).scalars().all())
    return random.choice(candidates) if candidates else None
