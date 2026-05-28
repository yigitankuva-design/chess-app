from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, nulls_last
from chess_api.models import ChildProfile, ChildRank, Rank


async def class_leaderboard(db: AsyncSession, class_id: int) -> list[dict]:
    q = (
        select(ChildProfile, ChildRank, Rank)
        .where(ChildProfile.class_id == class_id)
        .join(ChildRank, ChildRank.child_id == ChildProfile.id, isouter=True)
        .join(Rank, ChildRank.current_rank_id == Rank.id, isouter=True)
        .order_by(nulls_last(ChildRank.xp_total.desc()))
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "child_id": c.id,
            "display_name": c.display_name,
            "avatar": c.avatar,
            "xp_total": cr.xp_total if cr else 0,
            "rank_name": r.name_tr if r else "Piyon",
        }
        for c, cr, r in rows
    ]
