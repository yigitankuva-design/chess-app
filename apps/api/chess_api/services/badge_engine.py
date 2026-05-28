"""Event-based badge evaluation.

Call evaluate_event(db, child_id, event) after something happens. Engine
queries cumulative DB state and checks each not-yet-earned badge's criteria.
Returns the list of newly-awarded Badge objects.
"""
from dataclasses import dataclass
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import (
    Badge, ChildBadge, ChildLessonProgress, ChildPuzzleAttempt,
    Game, GameType, GameResult, LessonStatus, ChildRank, Rank,
)


@dataclass
class BadgeEvent:
    type: str
    module_order: int | None = None
    time_seconds: int | None = None


async def evaluate_event(db: AsyncSession, child_id: int, event: BadgeEvent) -> list[Badge]:
    existing_q = await db.execute(
        select(ChildBadge.badge_id).where(ChildBadge.child_id == child_id)
    )
    existing_ids = set(existing_q.scalars().all())

    all_badges = (await db.execute(select(Badge))).scalars().all()
    new_badges: list[Badge] = []

    for badge in all_badges:
        if badge.id in existing_ids:
            continue
        if await _check_criteria(db, child_id, badge.criteria_json, event):
            db.add(ChildBadge(child_id=child_id, badge_id=badge.id))
            new_badges.append(badge)

    if new_badges:
        await db.commit()
    return new_badges


async def _check_criteria(db, child_id, criteria, event) -> bool:
    ctype = criteria.get("type")

    if ctype == "lessons_completed":
        count = await db.scalar(
            select(func.count(ChildLessonProgress.id)).where(
                ChildLessonProgress.child_id == child_id,
                ChildLessonProgress.status == LessonStatus.completed,
            )
        )
        return (count or 0) >= criteria.get("count", 1)

    if ctype == "puzzles_solved":
        count = await db.scalar(
            select(func.count(ChildPuzzleAttempt.id)).where(
                ChildPuzzleAttempt.child_id == child_id,
                ChildPuzzleAttempt.success.is_(True),
            )
        )
        return (count or 0) >= criteria.get("count", 1)

    if ctype == "bot_wins":
        max_level = criteria.get("bot_level_max", 999)
        count = await db.scalar(
            select(func.count(Game.id)).where(
                Game.type == GameType.bot,
                Game.white_child_id == child_id,
                Game.result == GameResult.white_wins,
                Game.black_bot_level <= max_level,
            )
        )
        return (count or 0) >= criteria.get("count", 1)

    if ctype == "first_mate":
        return event.type == "first_mate"

    if ctype == "module_completed":
        return event.type == "module_completed" and event.module_order == criteria.get("module_order")

    if ctype == "fast_solve":
        return event.type == "puzzle_solved" and (event.time_seconds or 999) <= criteria.get("max_seconds", 999)

    if ctype == "rank_reached":
        cr = (await db.execute(select(ChildRank).where(ChildRank.child_id == child_id))).scalar_one_or_none()
        if not cr:
            return False
        rank = await db.get(Rank, cr.current_rank_id)
        return rank is not None and rank.order_index >= criteria.get("rank_order", 99)

    # Unsupported types (daily_streak, perfect_lesson, human_*, all_modules, daily_challenges, explorer)
    # are evaluated elsewhere or in later plans. Return False here.
    return False
