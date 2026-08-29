from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models.child import ChildProfile
from chess_api.services.rating import get_rating_and_title
from chess_api.services.tempo import TEMPO_CATEGORIES

router = APIRouter(tags=["athletes"])


@router.get("/athletes")
async def list_athletes(
    tempo: str | None = Query(default=None),
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcunun ARKADASLARI: AYNI HOCAYA bagli diger sporcular.

    Hocasi atanmamis sporcuya BOS liste doner — hangi akademide oldugu
    bilinmeyen bir cocuga baska cocuklarin adlari gosterilmez (gizlilik).

    Madde 6 (2026-08-20): ?tempo=Yıldırım|Hızlı|Klasik verilirse (Arkadaşla
    Oyna akışında kriter/tempo ÖNCE seçildiği için biliniyor) her sporcunun
    O TEMPODAKİ Performans Puanı/Ünvanı da döner — geçersiz/eksik tempo'da
    (ör. eski çağıranlar) bu alanlar sessizce None kalır, GERİYE UYUMLU.
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
    valid_tempo = tempo if tempo in TEMPO_CATEGORIES else None
    out = []
    for c in rows:
        rating = title = None
        if valid_tempo:
            rating, title = await get_rating_and_title(db, c.id, valid_tempo)
        out.append({"child_id": c.id, "display_name": c.display_name, "rating": rating, "title": title})
    return out
