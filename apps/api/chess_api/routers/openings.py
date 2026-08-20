from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.opening import Opening, OpeningVariant, OpeningType

router = APIRouter(tags=["openings"])


@router.get("/openings")
async def list_openings(db: AsyncSession = Depends(get_db)):
    """Sporcu mac kurarken tur+acilis+varyant secer — kimlik dogrulamasi
    gerekmez (mufredat listesi gibi herkese acik, /modules ile ayni desen).

    Madde (2026-08-20): "Açılış Türü" artik sabit 3 deger degil, admin'in
    yonettigi bir veri seviyesi (OpeningType) — donen sekil UC KATMANLI:
    tur -> acilis -> varyant."""
    types = (await db.execute(
        select(OpeningType).order_by(OpeningType.sort_order, OpeningType.id)
    )).scalars().all()
    openings = (await db.execute(
        select(Opening).order_by(Opening.sort_order, Opening.id)
    )).scalars().all()
    variants = (await db.execute(
        select(OpeningVariant).order_by(OpeningVariant.sort_order, OpeningVariant.id)
    )).scalars().all()

    by_opening: dict[int, list[OpeningVariant]] = {}
    for v in variants:
        by_opening.setdefault(v.opening_id, []).append(v)

    by_type: dict[int, list[Opening]] = {}
    for o in openings:
        by_type.setdefault(o.opening_type_id, []).append(o)

    return [
        {
            "id": t.id, "name": t.name,
            "openings": [
                {
                    "id": o.id, "name": o.name,
                    "variants": [
                        {"id": v.id, "name": v.name, "start_fen": v.start_fen}
                        for v in by_opening.get(o.id, [])
                    ],
                }
                for o in by_type.get(t.id, [])
            ],
        }
        for t in types
    ]
