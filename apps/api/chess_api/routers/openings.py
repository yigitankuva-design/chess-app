from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.opening import Opening, OpeningVariant

router = APIRouter(tags=["openings"])


@router.get("/openings")
async def list_openings(db: AsyncSession = Depends(get_db)):
    """Sporcu mac kurarken acilis+varyant secer — kimlik dogrulamasi
    gerekmez (mufredat listesi gibi herkese acik, /modules ile ayni desen).

    Madde (2026-08-20): her acilis artik kendi VARYANTLARINI (isim+FEN)
    ic ice tasir — acilisin kendisinde FEN yoktur."""
    openings = (await db.execute(
        select(Opening).order_by(Opening.sort_order, Opening.id)
    )).scalars().all()
    variants = (await db.execute(
        select(OpeningVariant).order_by(OpeningVariant.sort_order, OpeningVariant.id)
    )).scalars().all()
    by_opening: dict[int, list[OpeningVariant]] = {}
    for v in variants:
        by_opening.setdefault(v.opening_id, []).append(v)
    return [
        {
            "id": o.id, "name": o.name, "category": o.category or "diger",
            "variants": [
                {"id": v.id, "name": v.name, "start_fen": v.start_fen}
                for v in by_opening.get(o.id, [])
            ],
        }
        for o in openings
    ]
