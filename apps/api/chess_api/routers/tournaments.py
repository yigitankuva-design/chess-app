from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.database import get_db
from chess_api.dependencies.auth import get_current_child
from chess_api.models import (
    ChildProfile, Game, GameType, GameStatus,
    Tournament, TournamentStatus, TournamentParticipant, TournamentPairing,
)
from chess_api.services.tempo import tempo_category
from chess_api.services.rating import get_rating_or_default, title_for_rating

router = APIRouter(tags=["tournaments"])


def _tournament_out(t: Tournament) -> dict:
    return {
        "id": t.id, "name": t.name, "rounds_total": t.rounds_total,
        "base_ms": t.base_ms, "increment_ms": t.increment_ms,
        "status": t.status.value, "current_round": t.current_round,
        "rated": t.rated, "tempo": tempo_category(t.base_ms, t.increment_ms),
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
    return [{**_tournament_out(t), "joined": t.id in joined_ids} for t in rows]


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
    if t.status != TournamentStatus.upcoming:
        raise HTTPException(status_code=400, detail="Turnuva zaten başladı")
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
    rows = (await db.execute(
        select(TournamentParticipant, ChildProfile.display_name)
        .join(ChildProfile, ChildProfile.id == TournamentParticipant.child_id)
        .where(TournamentParticipant.tournament_id == tournament_id)
        .order_by(TournamentParticipant.score.desc(), TournamentParticipant.id)
    )).all()
    out = []
    for p, name in rows:
        rating = title = None
        if tempo:
            rating = await get_rating_or_default(db, p.child_id, tempo)
            title = title_for_rating(rating)
        out.append({"child_id": p.child_id, "display_name": name, "score": p.score,
                    "rating": rating, "title": title})
    return out


@router.get("/tournaments/{tournament_id}")
async def get_tournament(
    tournament_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    t = await _accessible_tournament(db, tournament_id, child)
    my_pairing = None
    if t.current_round is not None:
        pairing = (await db.execute(
            select(TournamentPairing).where(
                TournamentPairing.tournament_id == tournament_id,
                TournamentPairing.round_number == t.current_round,
                (TournamentPairing.white_child_id == child.id) | (TournamentPairing.black_child_id == child.id),
            )
        )).scalar_one_or_none()
        if pairing:
            opponent_id = pairing.black_child_id if pairing.white_child_id == child.id else pairing.white_child_id
            opponent_name = None
            if opponent_id:
                opponent = await db.get(ChildProfile, opponent_id)
                opponent_name = opponent.display_name if opponent else None
            my_pairing = {
                "id": pairing.id, "round_number": pairing.round_number,
                "is_bye": pairing.black_child_id is None,
                "opponent_name": opponent_name,
                "my_color": "white" if pairing.white_child_id == child.id else "black",
                "game_id": pairing.game_id, "result": pairing.result,
            }
    tempo = tempo_category(t.base_ms, t.increment_ms) if t.rated else None
    return {
        **_tournament_out(t),
        "standings": await _standings(db, tournament_id, tempo),
        "my_pairing": my_pairing,
    }


@router.post("/tournaments/{tournament_id}/pairings/{pairing_id}/start-game")
async def start_pairing_game(
    tournament_id: int,
    pairing_id: int,
    child: ChildProfile = Depends(get_current_child),
    db: AsyncSession = Depends(get_db),
):
    pairing = await db.get(TournamentPairing, pairing_id)
    if not pairing or pairing.tournament_id != tournament_id:
        raise HTTPException(status_code=404, detail="Pairing not found")
    # Yalnizca eslesmenin TARAFI olan sporcu maci baslatabilir (IDOR onlemi
    # — madde: mimari inceleme).
    if child.id not in (pairing.white_child_id, pairing.black_child_id):
        raise HTTPException(status_code=403, detail="Bu eşleşmenin tarafı değilsin")
    if pairing.black_child_id is None:
        raise HTTPException(status_code=400, detail="Bay geçme eşleşmesinde maç olmaz")
    if pairing.game_id is None:
        t = await db.get(Tournament, tournament_id)
        base_ms = t.base_ms if t else None
        increment_ms = t.increment_ms if t else None
        game = Game(
            type=GameType.human,
            white_child_id=pairing.white_child_id, black_child_id=pairing.black_child_id,
            status=GameStatus.active,
            base_ms=base_ms, increment_ms=increment_ms,
            white_ms=base_ms, black_ms=base_ms,
            last_clock_at=datetime.utcnow() if base_ms is not None else None,
            rated=t.rated if t else False,
        )
        db.add(game)
        await db.flush()
        pairing.game_id = game.id
        await db.commit()
    my_color = "white" if pairing.white_child_id == child.id else "black"
    return {"game_id": pairing.game_id, "color": my_color}
