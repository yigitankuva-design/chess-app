from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.opening import Opening

router = APIRouter(tags=["openings"])


@router.get("/openings")
async def list_openings(db: AsyncSession = Depends(get_db)):
    """Sporcu mac kurarken acilis secer — kimlik dogrulamasi gerekmez
    (mufredat listesi gibi herkese acik, /modules ile ayni desen)."""
    rows = (await db.execute(
        select(Opening).order_by(Opening.sort_order, Opening.id)
    )).scalars().all()
    return [{"id": o.id, "name": o.name, "start_fen": o.start_fen} for o in rows]
