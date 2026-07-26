from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.pool_image import PoolImage

router = APIRouter(tags=["pool-images"])


@router.get("/pool-images")
async def list_pool_images(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Görsel havuzunu listeler; `category` verilirse yalnızca o kategoriyi döner.

    Kimlik dogrulamasi gerekmez (/openings ve /modules ile ayni desen) — veri
    gizli degil, admin panelinde secim kaynagi olarak kullanilir.
    """
    stmt = select(PoolImage).order_by(PoolImage.id)
    if category:
        stmt = stmt.where(PoolImage.category == category)
    rows = (await db.execute(stmt)).scalars().all()
    return [{"id": p.id, "category": p.category, "data_uri": p.data_uri} for p in rows]
