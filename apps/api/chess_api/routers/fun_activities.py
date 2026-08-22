from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.fun_activity import FunActivity

router = APIRouter(tags=["fun_activities"])


@router.get("/fun-activities")
async def list_fun_activities(db: AsyncSession = Depends(get_db)):
    """Eğlence sekmesindeki oyun/yarışma kartları — kimlik doğrulaması
    gerekmez (müfredat listesi gibi herkese açık, /openings ile aynı desen)."""
    rows = (await db.execute(
        select(FunActivity).order_by(FunActivity.sort_order, FunActivity.id)
    )).scalars().all()
    return [
        {"id": r.id, "name": r.name, "description": r.description, "emoji": r.emoji}
        for r in rows
    ]
