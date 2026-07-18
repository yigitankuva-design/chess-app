from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models import AppSettings

router = APIRouter(tags=["settings"])


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Herkese açık. Sporcu app açılışta okur. Satır yoksa boş {} döner (app varsayılana düşer)."""
    row = (await db.execute(select(AppSettings).limit(1))).scalar_one_or_none()
    return row.data if row and isinstance(row.data, dict) else {}
