from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import (
    ChildProfile, Tournament, TournamentStatus, TournamentType,
    TournamentParticipant, TournamentPairing,
)
from chess_api.schemas.tournament import TournamentCreateRequest
from chess_api.services.tournaments import (
    compute_sonneborn_berger, sync_tournament_status, _ends_at,
)
from chess_api.services.swiss import advance_swiss_tournament
from chess_api.services.tempo import tempo_category
from chess_api.services.rating import get_rating_or_default, title_for_rating
from chess_api.routers.live_game import _create_human_game

router = APIRouter(tags=["tournaments"])

RECENT_PAIRINGS_LIMIT = 50


async def _sync_status(db: AsyncSession, t: Tournament) -> None:
    """Madde 2026-09-09/2026-09-10: turnuva durum geçişi tür bazında dallanır —
    arena `sync_tournament_status`'a (süre bazlı, services/tournaments.py),
    İsviçre `advance_swiss_tournament`'a (tur bazlı, services/swiss.py) gider.
    İkisi de AYNI lazy mimari (arka planda zamanlayıcı YOK). create_game,
    services'in routers'a bağımlı OLMAMASI için burada (router katmanında)
    tanımlanır — routers/tournament_ws.py'nin _create_pairing_game'iyle AYNI
    desen (routers/live_game.py'deki _create_human_game'i sarar)."""
    if t.tournament_type == TournamentType.swiss:
        async def _create_game(white_id: int, black_id: int) -> int:
            return await _create_human_game(
                white_id, black_id, base_ms=t.base_ms, increment_ms=t.increment_ms or 0,
                rated=t.rated, start_fen=t.start_fen,
            )

        await advance_swiss_tournament(db, t, create_game=_create_game)
    else:
        await sync_tournament_status(db, t)


def _group_owner_id(child: ChildProfile) -> int:
    """Turnuvanın kaydedileceği "grup" kimliği. Madde 2026-09-08: hocaya
    BAĞLI OLMAYAN sporcu da turnuva oluşturabilsin — hocası varsa turnuva
    hocanın adına (sınıf arkadaşları görsün diye), yoksa VELİSİNİN adına
    kaydedilir (en azından kendi/kardeşleri görüp katılabilsin, tamamen
    engellenmez)."""
    return child.teacher_user_id if child.teacher_user_id is not None else child.parent_user_id


def _tournament_out(t: Tournament) -> dict:
    # Madde 2026-09-10: İsviçre'de süre/bitiş kavramı YOK (bitiş tur sayısına
    # bağlı) — duration_minutes NULL olabilir, bu durumda ends_at/seconds_
    # remaining de anlamsız (None/0) döner.
    is_swiss = t.tournament_type == TournamentType.swiss
    ends_at = None if is_swiss else _ends_at(t)
    seconds_remaining = 0
    if not is_swiss and t.status == TournamentStatus.active:
        seconds_remaining = max(0, int((ends_at - datetime.utcnow()).total_seconds()))
    return {
        "id": t.id, "name": t.name,
        "starts_at": t.starts_at.isoformat(), "duration_minutes": t.duration_minutes,
        "ends_at": ends_at.isoformat() if ends_at else None, "seconds_remaining": seconds_remaining,
        "base_ms": t.base_ms, "increment_ms": t.increment_ms,
        "status": t.status.value,
        "rated": t.rated, "tempo": tempo_category(t.base_ms, t.increment_ms),
        "description": t.description, "start_fen": t.start_fen,
        "winning_streak_bonus": t.winning_streak_bonus,
        # Madde 2026-09-10 (Turnuva Türü / Berserk):
        "tournament_type": t.tournament_type.value,
        "rounds_total": t.rounds_total, "current_round": t.current_round,
        "berserk_enabled": t.berserk_enabled,
    }


@router.get("/tournaments")
async def list_tournaments(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-08 (1): TÜM turnuvalar TÜM sporculara açık — Lichess'te
    olduğu gibi açık lobi (uygulamaya giren herkes oluşturulmuş turnuvaları
    görebilir). Hoca/veli gruplama SADECE bir turnuvayı SİLME yetkisinde
    kullanılır (bkz. _owned_tournament) — görünürlükte artık hiç kullanılmaz."""
    # Madde 2026-09-09 (5): çekilmiş (left_at dolu) katılım artık listede/
    # sayaçta SAYILMAZ — satır silinmiyor (SB hesabı görsün diye) ama
    # "katıldım" durumu ve katılımcı sayısı bunu görmezden gelir.
    joined_ids = set((await db.execute(
        select(TournamentParticipant.tournament_id).where(
            TournamentParticipant.child_id == child.id,
            TournamentParticipant.left_at.is_(None),
        )
    )).scalars().all())

    rows = (await db.execute(
        select(Tournament).order_by(Tournament.created_at.desc())
    )).scalars().all()
    if not rows:
        return []
    for t in rows:
        await _sync_status(db, t)

    # Lobi tablosundaki "Katılımcı Sayısı" sütunu için (2026-09-07).
    all_ids = [t.id for t in rows]
    counts = dict((await db.execute(
        select(TournamentParticipant.tournament_id, func.count(TournamentParticipant.id))
        .where(
            TournamentParticipant.tournament_id.in_(all_ids),
            TournamentParticipant.left_at.is_(None),
        )
        .group_by(TournamentParticipant.tournament_id)
    )).all())

    return [
        {**_tournament_out(t), "joined": t.id in joined_ids, "participant_count": counts.get(t.id, 0)}
        for t in rows
    ]


@router.post("/tournaments", status_code=201)
async def create_tournament(
    payload: TournamentCreateRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcu kendi turnuvasını oluşturur — hocasına bağlı diğer sporcular da
    görebilsin diye turnuva hocanın (created_by_user_id) adına kaydedilir.
    Madde 2026-09-08: hocaya bağlı OLMAYAN sporcu da engellenmez — bu durumda
    turnuva velisinin adına kaydedilir (bkz. _group_owner_id). Oluşturan
    sporcu otomatik katılımcı olur (Lichess'te de öyle).

    Madde 2026-09-09 (4): created_by_child_id AYRICA kaydedilir — silme
    yetkisi artık SADECE bu sporcuya ait (created_by_user_id hoca/veli
    grubu içindir, o artık silme yetkisinde kullanılmıyor)."""
    t = Tournament(
        name=payload.name, created_by_user_id=_group_owner_id(child),
        created_by_child_id=child.id,
        starts_at=payload.starts_at, duration_minutes=payload.duration_minutes,
        base_ms=payload.base_ms, increment_ms=payload.increment_ms,
        rated=payload.rated,
        description=(payload.description or None),
        start_fen=(payload.start_fen or None),
        winning_streak_bonus=payload.winning_streak_bonus,
        tournament_type=TournamentType(payload.tournament_type),
        rounds_total=payload.rounds_total, current_round=0,
        berserk_enabled=payload.berserk_enabled,
    )
    db.add(t)
    await db.flush()
    db.add(TournamentParticipant(tournament_id=t.id, child_id=child.id))
    await db.commit()
    await db.refresh(t)
    await _sync_status(db, t)
    return {**_tournament_out(t), "joined": True}


async def _owned_tournament(db: AsyncSession, tournament_id: int, child: ChildProfile) -> Tournament:
    """Silme ucu icin — Madde 2026-09-09 (4): yetki artik SADECE turnuvayi
    OLUŞTURAN sporcuya ait (hoca/veli grubundaki BAŞKA sporcular ARTIK
    silemez — eski _in_same_group kuralindan DAHA SIKI)."""
    t = await db.get(Tournament, tournament_id)
    if not t or t.created_by_child_id != child.id:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


async def _accessible_tournament(db: AsyncSession, tournament_id: int, child: ChildProfile) -> Tournament:
    """Madde 2026-09-08 (1): açık lobi — herhangi bir turnuvanın detayına
    herhangi bir sporcu bakabilir (grup kısıtı yok, sadece var olmalı)."""
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


@router.post("/tournaments/{tournament_id}/join", status_code=201)
async def join_tournament(
    tournament_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    # Madde 2026-09-08 (1): açık lobi — grup kısıtı yok, herkes katılabilir.
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    await _sync_status(db, t)
    # Lichess Arena: devam eden bir turnuvaya sonradan katilmak serbest —
    # yalnizca bittiyse (finished) engellenir.
    if t.status == TournamentStatus.finished:
        raise HTTPException(status_code=400, detail="Turnuva bitti")
    # Madde 2026-09-10: İsviçre'de 1. tur başlayınca (eşleştirmeler üretilince)
    # katılım KAPANIR — yeni katılan turların ortasında rakipsiz kalırdı.
    if t.tournament_type == TournamentType.swiss and (t.current_round or 0) >= 1:
        raise HTTPException(status_code=400, detail="Turnuva başladı, katılım kapandı")
    existing = (await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.child_id == child.id,
        )
    )).scalar_one_or_none()
    if existing is None:
        db.add(TournamentParticipant(tournament_id=tournament_id, child_id=child.id))
        await db.commit()
    elif existing.left_at is not None:
        # Madde 2026-09-09 (5): daha önce çekilmiş — satır SİLİNMEDİĞİ için
        # (bkz. leave_tournament) burada sadece "geri döndü" işaretlenir,
        # dondurulmuş puanı/serisi AYNEN kalır (sıfırlanmaz).
        existing.left_at = None
        await db.commit()
    return {"joined": True}


@router.post("/tournaments/{tournament_id}/leave", status_code=200)
async def leave_tournament(
    tournament_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-09 (5): sporcu istediği zaman turnuvadan çıkabilir —
    katılım kaydı SİLİNMEZ (left_at doldurulur): ismi sıralama GÖRÜNÜMÜNDEN
    çıkar ve bir daha eşleştirilmez, ama puanı DB'de kalır ki rakiplerinin
    Sonneborn-Berger hesabı olumsuz etkilenmesin (bkz. compute_sonneborn_berger,
    services/tournaments.py). Sürmekte olan maçı ETKİLENMEZ — sadece bitirilir,
    ondan sonra eşleşmez."""
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    await db.execute(
        update(TournamentParticipant)
        .where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.child_id == child.id,
            TournamentParticipant.left_at.is_(None),
        )
        .values(left_at=datetime.utcnow())
    )
    await db.commit()
    return {"joined": False}


def _games_stats(pairings: list[TournamentPairing]) -> dict[int, tuple[int, int]]:
    """child_id -> (oynanmış oyun sayısı, galibiyet sayısı) — madde 2026-09-09
    (6), turnuva bitiş bildirimindeki "Oynanmış oyunlar"/"Kazanma oranı" için.
    None (hâlâ sürüyor) ve "void" (iptal edildi) eşleşmeler SAYILMAZ."""
    stats: dict[int, tuple[int, int]] = {}

    def _bump(child_id: int, win: bool) -> None:
        games, wins = stats.get(child_id, (0, 0))
        stats[child_id] = (games + 1, wins + (1 if win else 0))

    for pairing in pairings:
        if pairing.result is None or pairing.result == "void":
            continue
        white_wins = pairing.result == "1-0"
        black_wins = pairing.result == "0-1"
        _bump(pairing.white_child_id, white_wins)
        _bump(pairing.black_child_id, black_wins)
    return stats


async def _standings(db: AsyncSession, tournament_id: int, tempo: str | None = None) -> list[dict]:
    # TÜM katılımcılar (çekilmiş dahil) — Sonneborn-Berger'ın çekilenlerin
    # dondurulmuş puanını görmesi için (madde 2026-09-09 (5)).
    all_participants = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
    )).scalars().all()
    pairings = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == tournament_id)
    )).scalars().all()
    sb_map = compute_sonneborn_berger(all_participants, pairings)
    games_stats = _games_stats(pairings)

    # GÖRÜNÜM listesi: çekilenler (left_at dolu) sıralamadan düşer.
    participants = [p for p in all_participants if p.left_at is None]

    names: dict[int, str] = {}
    child_ids = [p.child_id for p in participants]
    if child_ids:
        rows = (await db.execute(
            select(ChildProfile.id, ChildProfile.display_name).where(ChildProfile.id.in_(child_ids))
        )).all()
        names = {cid: name for cid, name in rows}

    out = []
    for p in participants:
        rating = title = None
        if tempo:
            rating = await get_rating_or_default(db, p.child_id, tempo)
            title = title_for_rating(rating)
        games_played, wins = games_stats.get(p.child_id, (0, 0))
        win_rate = round(wins / games_played * 100) if games_played > 0 else None
        out.append({
            "child_id": p.child_id, "display_name": names.get(p.child_id),
            "score": p.score, "sb": sb_map.get(p.child_id, 0.0),
            "streak": p.current_streak,
            "rating": rating, "title": title,
            "games_played": games_played, "win_rate": win_rate,
        })
    out.sort(key=lambda d: (-d["score"], -d["sb"], d["child_id"]))
    return out


async def _recent_pairings(db: AsyncSession, tournament_id: int) -> list[dict]:
    rows = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == tournament_id)
        .order_by(TournamentPairing.id.desc()).limit(RECENT_PAIRINGS_LIMIT)
    )).scalars().all()
    child_ids = {p.white_child_id for p in rows} | {p.black_child_id for p in rows}
    names: dict[int, str] = {}
    if child_ids:
        name_rows = (await db.execute(
            select(ChildProfile.id, ChildProfile.display_name).where(ChildProfile.id.in_(child_ids))
        )).all()
        names = {cid: name for cid, name in name_rows}
    return [{
        "id": p.id,
        "white_child_id": p.white_child_id, "white_name": names.get(p.white_child_id),
        "black_child_id": p.black_child_id, "black_name": names.get(p.black_child_id),
        "game_id": p.game_id, "result": p.result,
        # Madde 2026-09-10: SADECE İsviçre'de dolu — arena'da hep None.
        "round_number": p.round_number,
    } for p in rows]


async def _my_active_pairing(db: AsyncSession, tournament_id: int, child_id: int) -> dict | None:
    """Sporcunun SU AN suren (henuz sonuclanmamis) esleşmesi — Arena'da 'round'
    kavrami yok, bu yuzden 'su anki mac' tek anlamli karsilik."""
    pairing = (await db.execute(
        select(TournamentPairing).where(
            TournamentPairing.tournament_id == tournament_id,
            TournamentPairing.result.is_(None),
            (TournamentPairing.white_child_id == child_id) | (TournamentPairing.black_child_id == child_id),
        ).order_by(TournamentPairing.id.desc())
    )).scalars().first()
    if pairing is None:
        return None
    opponent_id = pairing.black_child_id if pairing.white_child_id == child_id else pairing.white_child_id
    opponent = await db.get(ChildProfile, opponent_id)
    return {
        "id": pairing.id, "opponent_id": opponent_id,
        "opponent_name": opponent.display_name if opponent else None,
        "my_color": "white" if pairing.white_child_id == child_id else "black",
        "game_id": pairing.game_id,
    }


@router.get("/tournaments/{tournament_id}")
async def get_tournament(
    tournament_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    t = await _accessible_tournament(db, tournament_id, child)
    await _sync_status(db, t)
    tempo = tempo_category(t.base_ms, t.increment_ms) if t.rated else None
    joined = (await db.execute(
        select(TournamentParticipant.id).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.child_id == child.id,
            TournamentParticipant.left_at.is_(None),
        )
    )).first() is not None
    # Detay sayfasi footer'i icin ("Toplam Kisi Sayisi", 2026-09-09 madde 5)
    # — çekilenler sayılmaz.
    participant_count = (await db.execute(
        select(func.count(TournamentParticipant.id)).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.left_at.is_(None),
        )
    )).scalar_one()
    return {
        **_tournament_out(t),
        "joined": joined,
        "participant_count": participant_count,
        # Madde 2026-09-09 (4): "Turnuvayı Sil" SADECE oluşturana VE SADECE
        # henüz başlamadıysa gösterilsin.
        "can_delete": t.created_by_child_id == child.id and t.status == TournamentStatus.upcoming,
        "standings": await _standings(db, tournament_id, tempo),
        "my_pairing": await _my_active_pairing(db, tournament_id, child.id),
        "recent_pairings": await _recent_pairings(db, tournament_id),
    }


@router.delete("/tournaments/{tournament_id}")
async def delete_tournament(
    tournament_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Madde 2026-09-09 (4): yalnızca OLUŞTURAN sporcu (bkz. _owned_tournament)
    VE yalnızca turnuva HENÜZ BAŞLAMADIYSA silebilir — başladıktan sonra
    (active/finished) silme işlemi YOK."""
    t = await _owned_tournament(db, tournament_id, child)
    await _sync_status(db, t)
    if t.status != TournamentStatus.upcoming:
        raise HTTPException(status_code=400, detail="Başlamış bir turnuva silinemez")
    await db.execute(delete(TournamentPairing).where(TournamentPairing.tournament_id == tournament_id))
    await db.execute(delete(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id))
    await db.delete(t)
    await db.commit()
    return {"deleted": True}
