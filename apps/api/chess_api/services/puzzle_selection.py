import random
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Puzzle, ChildPuzzleAttempt


async def select_puzzle_for_child(
    db: AsyncSession,
    child_id: int,
    child_rating: int | None = None,
    module_id: int | None = None,
) -> Puzzle | None:
    """Adaptive selection — start easy, ramp up gradually.

    When no explicit rating is given, the child's target rating is derived from
    how many puzzles they have SOLVED: it starts at the floor (400) and rises
    ~25 points per solved puzzle (capped at 1400). Puzzles are picked within a
    band around that target. If the band is empty (e.g. the puzzle pool has no
    puzzles that low), we fall back to the globally easiest unseen puzzles, so a
    beginner is never handed a hard puzzle first and difficulty climbs steadily.
    """
    if child_rating is None:
        solved = await db.scalar(
            select(func.count(ChildPuzzleAttempt.id)).where(
                ChildPuzzleAttempt.child_id == child_id,
                ChildPuzzleAttempt.success.is_(True),
            )
        ) or 0
        child_rating = min(1400, 400 + solved * 25)

    band = 150
    rating_low = max(0, child_rating - band)
    rating_high = child_rating + band

    recent_ids = list((await db.execute(
        select(ChildPuzzleAttempt.puzzle_id)
        .where(ChildPuzzleAttempt.child_id == child_id)
        .order_by(ChildPuzzleAttempt.attempted_at.desc())
        .limit(50)
    )).scalars().all())

    async def fetch(filters, order):
        q = select(Puzzle).options(selectinload(Puzzle.themes))
        if filters:
            q = q.where(and_(*filters))
        q = q.order_by(*order).limit(30)
        return list((await db.execute(q)).scalars().all())

    def with_recent(filters):
        return filters + ([Puzzle.id.notin_(recent_ids)] if recent_ids else [])

    # 1) In-band, same module, most popular first
    candidates: list[Puzzle] = []
    if module_id:
        candidates = await fetch(
            with_recent([Puzzle.rating >= rating_low, Puzzle.rating <= rating_high,
                         Puzzle.module_id == module_id]),
            [Puzzle.popularity.desc()],
        )
    # 2) In-band, any module
    if not candidates:
        candidates = await fetch(
            with_recent([Puzzle.rating >= rating_low, Puzzle.rating <= rating_high]),
            [Puzzle.popularity.desc()],
        )
    # 3) Band empty → globally EASIEST unseen puzzles (ramp from the floor up)
    if not candidates:
        candidates = await fetch(
            with_recent([]),
            [Puzzle.rating.asc(), Puzzle.popularity.desc()],
        )
    # 4) Absolute last resort → easiest puzzle overall (ignore recent filter)
    if not candidates:
        candidates = await fetch([], [Puzzle.rating.asc()])

    return random.choice(candidates) if candidates else None
