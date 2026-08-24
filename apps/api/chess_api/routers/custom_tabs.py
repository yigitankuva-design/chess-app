from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.database import get_db
from chess_api.models.custom_tab import CustomTab, CustomTabSection

router = APIRouter(tags=["custom-tabs"])


@router.get("/custom-tabs")
async def list_custom_tabs(db: AsyncSession = Depends(get_db)):
    """Ana sayfa hızlı erişim için hafif liste — görsel/bölüm içermez.

    Kimlik doğrulaması gerekmez (/openings ve /pool-images ile aynı desen)."""
    rows = (await db.execute(
        select(CustomTab).order_by(CustomTab.order_index)
    )).scalars().all()
    return [{"id": t.id, "order_index": t.order_index, "label": t.label, "emoji": t.emoji} for t in rows]


@router.get("/custom-tabs/{tab_id}")
async def get_custom_tab(tab_id: int, db: AsyncSession = Depends(get_db)):
    """Bir sekmenin tüm bölümlerini (görsellerle) döner — sekme sayfası açılınca
    çağrılır. Liste DÜZ (flat) döner; her bölümün `parent_id`'si vardır
    (madde 2026-08-22 — iç içe alt sekmeler). Ağaç, çağıran tarafta
    parent_id'ye göre kurulur — admin/sporcu ekranlarındaki mevcut düz-liste
    state yönetimi (ekle/sil/güncelle) böylece değişmeden kalır."""
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    sections = (await db.execute(
        select(CustomTabSection).where(CustomTabSection.custom_tab_id == tab_id)
        .order_by(CustomTabSection.order_index)
    )).scalars().all()
    return {
        "id": tab.id, "label": tab.label, "emoji": tab.emoji,
        "sections": [
            {"id": s.id, "order_index": s.order_index, "title": s.title, "body": s.body,
             "images": s.images, "practice_positions": s.practice_positions, "emoji": s.emoji,
             "parent_id": s.parent_id, "board_exercises": s.board_exercises,
             "explanation_cards": s.explanation_cards}
            for s in sections
        ],
    }
