"""İsviçre usulü turnuva motoru — Arena'nın YANINDA ikinci bir mod
(madde 2026-09-10). Bu oturumun başında Arena'ya geçilirken tamamen
kaldırılmıştı (bkz. migration TournamentArena) — şimdi Zafer'in isteğiyle
İKİNCİ bir seçenek olarak geri geliyor, Arena SİLİNMİYOR.

Basitleştirilmiş İsviçre — bilinçli kapsam dışı bırakılanlar (plan onayında
netleşti): tam FIDE/Dutch-sistemi renk dengelemesi YOK (rastgele renk),
floater kuralları basitleştirildi. Puana göre azalan sırada greedy eşleştirme
(daha önce oynamamış en yakın puanlıyla) + bay (rakipsiz kalan — pairing/oyun
satırı OLUŞTURULMAZ, puan/seri doğrudan işlenir, bkz. bye_count).

Tur geçişi OTOMATİK ve LAZY — services/tournaments.py::sync_tournament_status
ile AYNI mimari desen (arka planda cron/scheduler YOK, her çağıran bunu
tetikler). Bu dosya `create_game` callback'i ALIR (routers/live_game.py'deki
_create_human_game'i SARAR) — services routers'a bağımlı OLMASIN diye
(arena_matchmaking.find_arena_opponent'taki AYNI bağımlılık-tersine-çevirme
deseni).
"""
import random
from dataclasses import dataclass
from datetime import datetime
from typing import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from chess_api.models import Tournament, TournamentParticipant, TournamentPairing, TournamentStatus
from chess_api.services.tournaments import _apply_arena_points

CreateGame = Callable[[int, int], Awaitable[int]]


@dataclass
class RoundPairing:
    white_child_id: int
    black_child_id: int


def generate_round_pairings(
    participants: list[TournamentParticipant],
    past_pairings: list[TournamentPairing],
) -> tuple[list[RoundPairing], int | None]:
    """Saf fonksiyon — DB'ye dokunmaz. `participants` GÖRÜNÜM listesi olmalı
    (left_at dolu olanlar çağıran tarafından zaten elenmiş olmalı).

    Tek sayıda katılımcı varsa: en AZ bay almış (bye_count), onlar arasında
    en DÜŞÜK puanlı bay alır (gerçek İsviçre pratiğiyle tutarlı — bay en
    zayıfa verilir). Kalanlar puana göre azalan sırada, daha önce OYNAMAMIŞ
    en yakın puanlıyla eşleştirilir; herkesle oynamışsa (küçük turnuvalarda
    olabilir) tekrara izin verilir (basitleştirme). Renk rastgele atanır.
    """
    played: dict[int, set[int]] = {}
    for p in past_pairings:
        played.setdefault(p.white_child_id, set()).add(p.black_child_id)
        played.setdefault(p.black_child_id, set()).add(p.white_child_id)

    pool = list(participants)
    bye_child_id: int | None = None
    if len(pool) % 2 == 1:
        bye_candidate = min(pool, key=lambda p: (p.bye_count, p.score, p.child_id))
        pool.remove(bye_candidate)
        bye_child_id = bye_candidate.child_id

    remaining = sorted(pool, key=lambda p: (-p.score, p.child_id))
    pairings: list[RoundPairing] = []
    while remaining:
        top = remaining.pop(0)
        opponent_idx = 0
        for i, cand in enumerate(remaining):
            if cand.child_id not in played.get(top.child_id, set()):
                opponent_idx = i
                break
        opponent = remaining.pop(opponent_idx)
        if random.random() < 0.5:
            pairings.append(RoundPairing(top.child_id, opponent.child_id))
        else:
            pairings.append(RoundPairing(opponent.child_id, top.child_id))

    return pairings, bye_child_id


async def _start_round(
    db: AsyncSession, tournament: Tournament, round_number: int, create_game: CreateGame,
) -> None:
    participants = (await db.execute(select(TournamentParticipant).where(
        TournamentParticipant.tournament_id == tournament.id,
        TournamentParticipant.left_at.is_(None),
    ))).scalars().all()
    past_pairings = (await db.execute(select(TournamentPairing).where(
        TournamentPairing.tournament_id == tournament.id,
    ))).scalars().all()

    if tournament.status == TournamentStatus.upcoming:
        tournament.status = TournamentStatus.active
        tournament.started_at = tournament.starts_at
    tournament.current_round = round_number

    if not participants:
        # Kimse katılmamış/hepsi çekilmiş — turnuva anlamsızca asılı kalmasın.
        tournament.status = TournamentStatus.finished
        tournament.finished_at = datetime.utcnow()
        await db.commit()
        return

    pairings, bye_child_id = generate_round_pairings(participants, past_pairings)

    if bye_child_id is not None:
        bye_p = next(p for p in participants if p.child_id == bye_child_id)
        _apply_arena_points(bye_p, is_win=True, is_draw=False, streak_bonus=tournament.winning_streak_bonus)
        bye_p.bye_count += 1

    for pr in pairings:
        game_id = await create_game(pr.white_child_id, pr.black_child_id)
        db.add(TournamentPairing(
            tournament_id=tournament.id,
            white_child_id=pr.white_child_id, black_child_id=pr.black_child_id,
            game_id=game_id, round_number=round_number,
        ))
    await db.commit()


async def advance_swiss_tournament(
    db: AsyncSession, tournament: Tournament, create_game: CreateGame,
) -> None:
    """Lazy — services/tournaments.py::sync_tournament_status ile AYNI
    "her çağıran tetikler" mimarisi. Turnuva HENÜZ başlamadıysa VE zamanı
    geldiyse 1. turu üretir; aktifse VE o turdaki TÜM eşleşmeler
    sonuçlandıysa (result dolu veya "void") ya bir sonraki turu üretir ya
    da (son turdaysa) turnuvayı bitirir."""
    if tournament.status == TournamentStatus.upcoming:
        if datetime.utcnow() >= tournament.starts_at:
            await _start_round(db, tournament, round_number=1, create_game=create_game)
        return
    if tournament.status != TournamentStatus.active:
        return

    pairings_this_round = (await db.execute(select(TournamentPairing).where(
        TournamentPairing.tournament_id == tournament.id,
        TournamentPairing.round_number == tournament.current_round,
    ))).scalars().all()
    if any(p.result is None for p in pairings_this_round):
        return  # tur hâlâ sürüyor

    if (tournament.rounds_total or 0) <= (tournament.current_round or 0):
        tournament.status = TournamentStatus.finished
        tournament.finished_at = datetime.utcnow()
        await db.commit()
        return

    await _start_round(db, tournament, round_number=(tournament.current_round or 0) + 1, create_game=create_game)
