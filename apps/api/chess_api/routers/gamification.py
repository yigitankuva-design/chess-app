from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import ChildProfile, Badge, ChildBadge, Rank, ChildRank
from chess_api.services.profile_edit import nickname_next_change_at

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/badges")
async def list_badges(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """List all badges with earned flag for current child."""
    all_badges = (await db.execute(select(Badge))).scalars().all()
    earned_q = await db.execute(
        select(ChildBadge.badge_id).where(ChildBadge.child_id == child.id)
    )
    earned_ids = set(earned_q.scalars().all())
    return [
        {
            "slug": b.slug,
            "name_tr": b.name_tr,
            "description_tr": b.description_tr,
            "icon": b.icon,
            "earned": b.id in earned_ids,
        }
        for b in all_badges
    ]


async def _compute_progress(child: ChildProfile, db: AsyncSession) -> dict:
    """`/me`'nin gövdesi — madde 2026-09-07 (GRUP B): antrenörün salt-okunur
    öğrenci-profili uçları (teacher.py) da AYNI mantığı kullanır diye
    ayrı bir fonksiyona çıkarıldı. Davranış DEĞİŞMEDİ (KURAL #3)."""
    cr = (await db.execute(
        select(ChildRank).where(ChildRank.child_id == child.id)
    )).scalar_one_or_none()

    earned_count = await db.scalar(
        select(func.count(ChildBadge.id)).where(ChildBadge.child_id == child.id)
    )
    total_badges = await db.scalar(select(func.count(Badge.id)))

    if not cr:
        # Default to first rank if child has no rank yet
        first = (await db.execute(
            select(Rank).order_by(Rank.order_index).limit(1)
        )).scalar_one_or_none()
        rank_name = first.name_tr if first else "Piyon"
        rank_icon = first.icon if first else "rank-pawn"
        xp_total = 0
        next_xp = first.xp_required if first else 0
    else:
        rank = await db.get(Rank, cr.current_rank_id)
        rank_name = rank.name_tr if rank else "Piyon"
        rank_icon = rank.icon if rank else "rank-pawn"
        xp_total = cr.xp_total
        # Find next rank's xp_required
        next_rank = (await db.execute(
            select(Rank).where(Rank.xp_required > xp_total)
            .order_by(Rank.xp_required).limit(1)
        )).scalar_one_or_none()
        next_xp = next_rank.xp_required if next_rank else xp_total

    return {
        "rank_name": rank_name,
        "rank_icon": rank_icon,
        "xp_total": xp_total,
        "next_rank_xp": next_xp,
        "badges_earned": earned_count or 0,
        "badges_total": total_badges or 0,
        # Madde 2026-09-06: Profil kimlik şeridinde üyelik tarihi gösterimi.
        "member_since": child.created_at.date().isoformat(),
        # Madde 2026-09-07 (GRUP C): kimlik kartları — fotoğraf/il/iletişim.
        # Hepsi NULL olabilir (veli henüz doldurmadıysa) — frontend bunu
        # zaten "ikon avatar göster"/"iletişim bilgisi eksik" olarak yorumlar.
        "photo_data_url": child.photo_data_url,
        # Madde 2026-09-11 (Görsel Turu Aşama B): düzenlenebilir alanlar +
        # nickname (3 ayda 1 kuralı için sonraki değişiklik tarihi).
        "country": child.country,
        "nickname": child.nickname,
        "nickname_changed_at": child.nickname_changed_at.isoformat() if child.nickname_changed_at else None,
        "nickname_next_change_at": (lambda n: n.isoformat() if n else None)(nickname_next_change_at(child)),
        "province": child.province,
        "athlete_phone": child.athlete_phone,
        "athlete_email": child.athlete_email,
        # Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): yeni "Kayıt
        # Ol" formunun eklediği Lichess kullanıcı adı.
        "lichess_username": child.lichess_username,
        "father_name": child.father_name,
        "father_phone": child.father_phone,
        "father_email": child.father_email,
        "mother_name": child.mother_name,
        "mother_phone": child.mother_phone,
        "mother_email": child.mother_email,
    }


@router.get("/me")
async def my_progress(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Get current child's rank, XP, and badge progress."""
    return await _compute_progress(child, db)
