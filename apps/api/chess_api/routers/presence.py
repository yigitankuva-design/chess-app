import time

from fastapi import APIRouter, Depends

from chess_api.dependencies.auth import get_current_child
from chess_api.models.child import ChildProfile
from chess_api.services.presence import active_count, touch

router = APIRouter(tags=["presence"])


@router.post("/presence/ping")
async def presence_ping(child: ChildProfile = Depends(get_current_child)):
    """Sporcunun 'uygulamadayim' sinyali. Cevapta AKTIF DIGER sporcu sayisi doner.

    Ayri bir GET /presence/count ucu YOKTUR — ping zaten sunucuya gidiyor,
    sayiyi da o tasir (tek uc, tek istek).
    """
    now = time.time()
    touch(child.id, child.display_name, now)
    return {"count": active_count(exclude=child.id, now=now)}
