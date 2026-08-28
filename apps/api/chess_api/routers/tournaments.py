from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import (
    ChildProfile, Tournament, TournamentStatus, TournamentParticipant, TournamentPairing,
)
from chess_api.schemas.tournament import TournamentCreateRequest
from chess_api.services.tournaments import compute_sonneborn_berger
from chess_api.services.tempo import tempo_category
from chess_api.services.rating import get_rating_or_default, title_for_rating

router = APIRouter(tags=["tournaments"])

RECENT_PAIRINGS_LIMIT = 50


def _ends_at(t: Tournament) -> datetime:
    return t.starts_at + timedelta(minutes=t.duration_minutes)


async def _sync_status(db: AsyncSession, t: Tournament) -> None:
    """Lazy durum gecisi (upcoming->active->finished) — arka planda cron/
    scheduler YOK (madde: mimari kisit). Her list/get cagrisinda 'now' ile
    starts_at/ends_at karsilastirilip gerekirse aninda guncellenir."""
    now = datetime.utcnow()
    changed = False
    if t.status == TournamentStatus.upcoming and now >= t.starts_at:
        t.status = TournamentStatus.active
        t.started_at = t.starts_at
        changed = True
    if t.status == TournamentStatus.active and now >= _ends_at(t):
        t.status = TournamentStatus.finished
        t.finished_at = _ends_at(t)
        changed = True
    if changed:
        await db.commit()
        await db.refresh(t)


def _tournament_out(t: Tournament) -> dict:
    ends_at = _ends_at(t)
    seconds_remaining = 0
    if t.status == TournamentStatus.active:
        seconds_remaining = max(0, int((ends_at - datetime.utcnow()).total_seconds()))
    return {
        "id": t.id, "name": t.name,
        "starts_at": t.starts_at.isoformat(), "duration_minutes": t.duration_minutes,
        "ends_at": ends_at.isoformat(), "seconds_remaining": seconds_remaining,
        "base_ms": t.base_ms, "increment_ms": t.increment_ms,
        "status": t.status.value,
        "rated": t.rated, "tempo": tempo_category(t.base_ms, t.increment_ms),
        "description": t.description, "start_fen": t.start_fen,
        "winning_streak_bonus": t.winning_streak_bonus,
    }


@router.get("/tournaments")
async def list_tournaments(
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcunun görebileceği turnuvalar: (a) hâlâ hocasına bağlı olduğu
    turnuvalar, (b) daha önce katıldığı — hocası sonradan değişse bile
    zaten katıldığı turnuva görünmeye devam eder (madde: mimari inceleme)."""
    joined_ids = set((await db.execute(
        select(TournamentParticipant.tournament_id).where(TournamentParticipant.child_id == child.id)
    )).scalars().all())

    visible_ids: set[int] = set(joined_ids)
    if child.teacher_user_id is not None:
        by_teacher = (await db.execute(
            select(Tournament.id).where(Tournament.created_by_user_id == child.teacher_user_id)
        )).scalars().all()
        visible_ids |= set(by_teacher)

    if not visible_ids:
        return []
    rows = (await db.execute(
        select(Tournament).where(Tournament.id.in_(visible_ids)).order_by(Tournament.created_at.desc())
    )).scalars().all()
    for t in rows:
        await _sync_status(db, t)
    return [{**_tournament_out(t), "joined": t.id in joined_ids} for t in rows]


@router.post("/tournaments", status_code=201)
async def create_tournament(
    payload: TournamentCreateRequest,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    """Sporcu kendi turnuvasını oluşturur — hocasına bağlı diğer sporcular da
    görebilsin diye turnuva hocanın (created_by_user_id) adına kaydedilir.
    Oluşturan sporcu otomatik katılımcı olur (Lichess'te de öyle)."""
    if child.teacher_user_id is None:
        raise HTTPException(status_code=400, detail="Bir hocaya bağlı değilsin")
    t = Tournament(
        name=payload.name, created_by_user_id=child.teacher_user_id,
        starts_at=payload.starts_at, duration_minutes=payload.duration_minutes,
        base_ms=payload.base_ms, increment_ms=payload.increment_ms,
        rated=payload.rated,
        description=(payload.description or None),
        start_fen=(payload.start_fen or None),
        winning_streak_bonus=payload.winning_streak_bonus,
    )
    db.add(t)
    await db.flush()
    db.add(TournamentParticipant(tournament_id=t.id, child_id=child.id))
    await db.commit()
    await db.refresh(t)
    await _sync_status(db, t)
    return {**_tournament_out(t), "joined": True}


async def _owned_tournament(db: AsyncSession, tournament_id: int, child: ChildProfile) -> Tournament:
    """Yönetim uçları (sil) için — turnuva child'ın hocasına ait olmalı."""
    t = await db.get(Tournament, tournament_id)
    if not t or t.created_by_user_id != child.teacher_user_id:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


async def _accessible_tournament(db: AsyncSession, tournament_id: int, child: ChildProfile) -> Tournament:
    t = await db.get(Tournament, tournament_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    is_participant = (await db.execute(
        select(TournamentParticipant.id).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.child_id == child.id,
        )
    )).first() is not None
    if not is_participant and t.created_by_user_id != child.teacher_user_id:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


@router.post("/tournaments/{tournament_id}/join", status_code=201)
async def join_tournament(
    tournament_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    t = await db.get(Tournament, tournament_id)
    if not t or t.created_by_user_id != child.teacher_user_id:
        raise HTTPException(status_code=404, detail="Tournament not found")
    await _sync_status(db, t)
    # Lichess Arena: devam eden bir turnuvaya sonradan katilmak serbest —
    # yalnizca bittiyse (finished) engellenir.
    if t.status == TournamentStatus.finished:
        raise HTTPException(status_code=400, detail="Turnuva bitti")
    existing = (await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.child_id == child.id,
        )
    )).scalar_one_or_none()
    if existing:
        return {"joined": True}
    db.add(TournamentParticipant(tournament_id=tournament_id, child_id=child.id))
    await db.commit()
    return {"joined": True}


async def _standings(db: AsyncSession, tournament_id: int, tempo: str | None = None) -> list[dict]:
    participants = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
    )).scalars().all()
    pairings = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.tournament_id == tournament_id)
    )).scalars().all()
    sb_map = compute_sonneborn_berger(participants, pairings)

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
        out.append({
            "child_id": p.child_id, "display_name": names.get(p.child_id),
            "score": p.score, "sb": sb_map.get(p.child_id, 0.0),
            "streak": p.current_streak,
            "rating": rating, "title": title,
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
        )
    )).first() is not None
    return {
        **_tournament_out(t),
        "joined": joined,
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
    t = await _owned_tournament(db, tournament_id, child)
    await db.execute(delete(TournamentPairing).where(TournamentPairing.tournament_id == tournament_id))
    await db.execute(delete(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id))
    await db.delete(t)
    await db.commit()
    return {"deleted": True}
