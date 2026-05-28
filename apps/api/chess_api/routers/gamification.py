from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_user
from chess_api.models import User, Badge, ChildBadge, Rank, ChildRank

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/badges")
async def list_badges(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all badges with earned flag for current user."""
    all_badges = (await db.execute(select(Badge))).scalars().all()
    earned_q = await db.execute(
        select(ChildBadge.badge_id).where(ChildBadge.child_id == current.id)
    )
    earned_ids = set(earned_q.scalars().all())
    return [
        {
            "slug": b.slug,
            "name_tr": b.name_tr,
            "description_tr": b.description_tr,
            "icon": b.icon,
            "earned": b.id in earned_ids,
        }
        for b in all_badges
    ]


@router.get("/me")
async def my_progress(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's rank, XP, and badge progress."""
    cr = (await db.execute(
        select(ChildRank).where(ChildRank.child_id == current.id)
    )).scalar_one_or_none()

    earned_count = await db.scalar(
        select(func.count(ChildBadge.id)).where(ChildBadge.child_id == current.id)
    )
    total_badges = await db.scalar(select(func.count(Badge.id)))

    if not cr:
        # Default to first rank if user has no rank yet
        first = (await db.execute(
            select(Rank).order_by(Rank.order_index).limit(1)
        )).scalar_one_or_none()
        rank_name = first.name_tr if first else "Piyon"
        rank_icon = first.icon if first else "rank-pawn"
        xp_total = 0
        next_xp = first.xp_required if first else 0
    else:
        rank = await db.get(Rank, cr.current_rank_id)
        rank_name = rank.name_tr if rank else "Piyon"
        rank_icon = rank.icon if rank else "rank-pawn"
        xp_total = cr.xp_total
        # Find next rank's xp_required
        next_rank = (await db.execute(
            select(Rank).where(Rank.xp_required > xp_total)
            .order_by(Rank.xp_required).limit(1)
        )).scalar_one_or_none()
        next_xp = next_rank.xp_required if next_rank else xp_total

    return {
        "rank_name": rank_name,
        "rank_icon": rank_icon,
        "xp_total": xp_total,
        "next_rank_xp": next_xp,
        "badges_earned": earned_count or 0,
        "badges_total": total_badges or 0,
    }
