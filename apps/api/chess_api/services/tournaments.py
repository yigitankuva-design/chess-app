"""Turnuva eslestirme (basitlestirilmis Isvicre usulu) ve mac-bitince-puanlama.

Gercek FIDE Isvicre sistemi (Buchholz/Sonneborn-Berger tie-break, renk
dengesi, vb.) bu uygulamanin olcegi (sinif ici birkac sporcu, birkac tur)
icin gereksiz karmasiklik. Burada GREEDY bir esleme yapilir: puana gore
sirala, en ustten baslayarak her oyuncuyu DAHA ONCE OYNAMADIGI en yakin
puanli rakiple esle. Gerideki izleme (backtracking) YOKTUR — uygun rakip
bulunamazsa (herkesle oynamis), tekrar eslesmeye izin verilir; sistem asla
kilitlenmez.
"""
import random
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Game, GameType, TournamentPairing, TournamentParticipant


async def _played_pairs(db: AsyncSession, tournament_id: int) -> set[frozenset[int]]:
    rows = (await db.execute(
        select(TournamentPairing.white_child_id, TournamentPairing.black_child_id)
        .where(TournamentPairing.tournament_id == tournament_id)
    )).all()
    return {frozenset((w, b)) for w, b in rows if b is not None}


async def _bye_takers(db: AsyncSession, tournament_id: int) -> set[int]:
    rows = (await db.execute(
        select(TournamentPairing.white_child_id)
        .where(
            TournamentPairing.tournament_id == tournament_id,
            TournamentPairing.black_child_id.is_(None),
        )
    )).scalars().all()
    return set(rows)


def _pick_bye(candidates: list[int], already_had_bye: set[int]) -> int:
    """Daha once bay gecmemis birini tercih eder — ayni kisi art arda bay
    gecip haksiz puan almasin diye. Hepsi bay gectiyse (kucuk turnuvada
    olasi) rastgele biri secilir."""
    fresh = [c for c in candidates if c not in already_had_bye]
    pool = fresh if fresh else candidates
    return random.choice(pool)


async def generate_pairings(
    db: AsyncSession, tournament_id: int, round_number: int,
) -> list[TournamentPairing]:
    """Verilen tur icin eslesme satirlari OLUSTURUR (db.add), commit ETMEZ."""
    participants = (await db.execute(
        select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
    )).scalars().all()

    played = await _played_pairs(db, tournament_id)
    already_had_bye = await _bye_takers(db, tournament_id)

    if round_number == 1:
        order = [p.child_id for p in participants]
        random.shuffle(order)
    else:
        # Puana gore azalan; esitlikte KARARLI sira (join sirasi) — rastgele
        # sallanti her "sonraki tur" cagrisinda farkli sonuc uretmesin diye.
        order = [p.child_id for p in sorted(participants, key=lambda p: (-p.score, p.id))]

    remaining = list(order)
    bye_id: int | None = None
    if len(remaining) % 2 == 1:
        bye_id = _pick_bye(remaining, already_had_bye)
        remaining.remove(bye_id)

    pairings: list[TournamentPairing] = []
    while remaining:
        top = remaining.pop(0)
        # En yakin puanli (siradaki), daha once oynamamis ilk rakibi bul.
        opponent = None
        for cand in remaining:
            if frozenset((top, cand)) not in played:
                opponent = cand
                break
        if opponent is None:
            # Herkesle oynamis (kucuk turnuva) — tekrar eslesmeye izin ver,
            # sistem kilitlenmesin.
            opponent = remaining[0]
        remaining.remove(opponent)
        pairing = TournamentPairing(
            tournament_id=tournament_id, round_number=round_number,
            white_child_id=top, black_child_id=opponent,
        )
        db.add(pairing)
        pairings.append(pairing)

    if bye_id is not None:
        bye_pairing = TournamentPairing(
            tournament_id=tournament_id, round_number=round_number,
            white_child_id=bye_id, black_child_id=None, result="bye",
        )
        db.add(bye_pairing)
        pairings.append(bye_pairing)
        for p in participants:
            if p.child_id == bye_id:
                p.score += 1.0

    return pairings


async def finalize_tournament_pairing(db: AsyncSession, game: Game) -> None:
    """Insan-insan bir mac bitince (checkmate/pat/terk/bayrak/beraberlik —
    TUMU icin TEK cagri noktasi) — eger bu mac bir turnuva eslesmesine
    baglıysa, sonucu esleme satirina yazar ve iki tarafin puanini gunceller.

    Bagli degilse (sıradan Arkadasla Oyna maci) HICBIR SEY yapmaz.
    """
    if game.type != GameType.human or game.result is None:
        return
    pairing = (await db.execute(
        select(TournamentPairing).where(TournamentPairing.game_id == game.id)
    )).scalar_one_or_none()
    if pairing is None or pairing.result is not None:
        return  # turnuva maci degil, veya zaten islenmis (iki kez yazilmasin)

    pairing.result = game.result.value

    participants = (await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == pairing.tournament_id,
            TournamentParticipant.child_id.in_([pairing.white_child_id, pairing.black_child_id]),
        )
    )).scalars().all()
    by_child = {p.child_id: p for p in participants}

    if game.result.value == "1-0":
        white_pts, black_pts = 1.0, 0.0
    elif game.result.value == "0-1":
        white_pts, black_pts = 0.0, 1.0
    else:
        white_pts, black_pts = 0.5, 0.5

    if pairing.white_child_id in by_child:
        by_child[pairing.white_child_id].score += white_pts
    if pairing.black_child_id in by_child:
        by_child[pairing.black_child_id].score += black_pts
