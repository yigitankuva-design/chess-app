"""XP accumulation + rank-up."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Rank, ChildRank


XP_EVENTS = {
    "lesson_completed": 30,
    "puzzle_solved": 10,
    "bot_win": 20,
    "human_win": 50,
    "daily_challenge_solved": 25,
    "module_completed": 100,
}


async def add_xp(db: AsyncSession, child_id: int, event_type: str) -> dict:
    xp = XP_EVENTS.get(event_type, 0)
    if xp == 0:
        return {"awarded": 0}

    cr = (await db.execute(select(ChildRank).where(ChildRank.child_id == child_id))).scalar_one_or_none()
    if not cr:
        first_rank = (await db.execute(select(Rank).order_by(Rank.order_index).limit(1))).scalar_one_or_none()
        if not first_rank:
            return {"awarded": 0, "error": "no ranks seeded"}
        cr = ChildRank(child_id=child_id, current_rank_id=first_rank.id, xp_total=0)
        db.add(cr)
        await db.flush()

    cr.xp_total += xp

    new_rank = (await db.execute(
        select(Rank).where(Rank.xp_required <= cr.xp_total).order_by(Rank.order_index.desc()).limit(1)
    )).scalar_one()
    leveled_up = new_rank.id != cr.current_rank_id
    cr.current_rank_id = new_rank.id

    await db.commit()
    return {"awarded": xp, "new_xp": cr.xp_total, "rank": new_rank.name_tr, "leveled_up": leveled_up}
