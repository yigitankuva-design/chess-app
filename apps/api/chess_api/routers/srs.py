from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, SRSCard
from chess_api.services.srs import update_card, SRSResult


class SRSCardResponse(BaseModel):
    id: int
    item_type: str
    item_id: int
    due_at: datetime


class ReviewRequest(BaseModel):
    result: SRSResult


router = APIRouter(prefix="/srs", tags=["srs"])


@router.get("/due", response_model=list[SRSCardResponse])
async def due_cards(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Get all due SRS cards for the current child, limited to 20."""
    q = select(SRSCard).where(
        SRSCard.child_id == child.id,
        SRSCard.due_at <= datetime.utcnow(),
    ).order_by(SRSCard.due_at).limit(20)
    cards = (await db.execute(q)).scalars().all()
    return [
        SRSCardResponse(id=c.id, item_type=c.item_type.value, item_id=c.item_id, due_at=c.due_at)
        for c in cards
    ]


@router.post("/{card_id}/review")
async def review_card(
    card_id: int,
    payload: ReviewRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Review an SRS card and update its state."""
    card = await db.get(SRSCard, card_id)
    if not card or card.child_id != child.id:
        return {"updated": False}

    updates = update_card(card.interval_days, card.ease_factor, card.reps_count, payload.result)
    for k, v in updates.items():
        setattr(card, k, v)
    await db.commit()
    return {"updated": True, "next_due_at": card.due_at.isoformat()}
