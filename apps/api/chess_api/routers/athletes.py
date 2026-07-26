from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models.child import ChildProfile

router = APIRouter(tags=["athletes"])


@router.get("/athletes")
async def list_athletes(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcunun ARKADASLARI: AYNI HOCAYA bagli diger sporcular.

    Hocasi atanmamis sporcuya BOS liste doner — hangi akademide oldugu
    bilinmeyen bir cocuga baska cocuklarin adlari gosterilmez (gizlilik).
    """
    if child.teacher_user_id is None:
        return []
    rows = (await db.execute(
        select(ChildProfile)
        .where(
            ChildProfile.teacher_user_id == child.teacher_user_id,
            ChildProfile.id != child.id,
        )
        .order_by(ChildProfile.display_name)
    )).scalars().all()
    return [{"child_id": c.id, "display_name": c.display_name} for c in rows]
