"""Turnuva puanlama — Lichess Arena modeli (2026-09-05).

Eslesmeler artik bu dosyada URETILMIYOR: rakip bulma islemi
`services/arena_matchmaking.py`'deki canli kuyruga tasindi (sporcu maçini
bitirip turnuva sayfasina donunce, o anki puanina EN YAKIN bekleyen rakiple
ANINDA eslesir — sabit tur YOK). Bu dosyada yalnizca:
- bir mac bitince turnuva puanini guncelleyen TEK cagri noktasi
  (`finalize_tournament_pairing`, Lichess'in 2/1/0 + seri katlama kurali),
- siralama esitliginde kullanilan Sonneborn-Berger ("averaj") hesabi
kalir.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import Game, GameType, Tournament, TournamentPairing, TournamentParticipant


def _apply_arena_points(
    participant: TournamentParticipant, *, is_win: bool, is_draw: bool, streak_bonus: bool = True,
) -> None:
    """Lichess Arena puanlamasi: galibiyet=2, beraberlik=1, kayip=0. "Galibiyet
    Ödülü" (streak_bonus) acikken 2 galibiyet ust uste gelince ("seri") sonraki
    HER sonuc (bu dahil) KATLANIR — maglubiyet veya galibiyet-olmayan bir sonuc
    seriyi sifirlar. Katlama, BU macin sonucundan ONCEKI seri sayisina gore
    karar verilir (Lichess ornegi: 2 galibiyet + 1 beraberlik = 2 + 2 + (2*1) =
    6 puan). streak_bonus KAPALIYSA seri yine sayilir (ileride acilirsa diye)
    ama HICBIR sonuc katlanmaz — hep duz 2/1/0."""
    base = 2.0 if is_win else (1.0 if is_draw else 0.0)
    points = base * 2 if streak_bonus and participant.current_streak >= 2 else base
    participant.current_streak = participant.current_streak + 1 if is_win else 0
    participant.score += points


async def finalize_tournament_pairing(db: AsyncSession, game: Game) -> None:
    """Insan-insan bir mac bitince (checkmate/pat/terk/bayrak/beraberlik —
    TUMU icin TEK cagri noktasi) — eger bu mac bir turnuva eslesmesine
    baglıysa, sonucu esleme satirina yazar ve iki tarafin puanini/serisini
    Lichess Arena kuralina gore gunceller.

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

    tournament = await db.get(Tournament, pairing.tournament_id)
    streak_bonus = tournament.winning_streak_bonus if tournament else True

    participants = (await db.execute(
        select(TournamentParticipant).where(
            TournamentParticipant.tournament_id == pairing.tournament_id,
            TournamentParticipant.child_id.in_([pairing.white_child_id, pairing.black_child_id]),
        )
    )).scalars().all()
    by_child = {p.child_id: p for p in participants}

    is_draw = game.result.value == "1/2-1/2"
    white_wins = game.result.value == "1-0"

    white_p = by_child.get(pairing.white_child_id)
    black_p = by_child.get(pairing.black_child_id)
    if white_p is not None:
        _apply_arena_points(white_p, is_win=white_wins and not is_draw, is_draw=is_draw, streak_bonus=streak_bonus)
    if black_p is not None:
        _apply_arena_points(black_p, is_win=(not white_wins) and not is_draw, is_draw=is_draw, streak_bonus=streak_bonus)


def compute_sonneborn_berger(
    participants: list[TournamentParticipant], pairings: list[TournamentPairing],
) -> dict[int, float]:
    """Siralama esitliginde kullanilan "averaj": kazandigin rakiplerin GUNCEL
    toplam puani tam, berabere kaldiklarinin yarisi eklenir (klasik
    FIDE/Isvicre usulu Sonneborn-Berger). Saf fonksiyon — DB'ye dokunmaz."""
    score_by_child = {p.child_id: p.score for p in participants}
    sb: dict[int, float] = {p.child_id: 0.0 for p in participants}

    for pairing in pairings:
        if pairing.result is None or pairing.result == "1/2-1/2":
            is_draw = pairing.result == "1/2-1/2"
            if is_draw:
                w_opp = score_by_child.get(pairing.black_child_id, 0.0)
                b_opp = score_by_child.get(pairing.white_child_id, 0.0)
                if pairing.white_child_id in sb:
                    sb[pairing.white_child_id] += w_opp / 2
                if pairing.black_child_id in sb:
                    sb[pairing.black_child_id] += b_opp / 2
            continue

        winner_id = pairing.white_child_id if pairing.result == "1-0" else pairing.black_child_id
        loser_id = pairing.black_child_id if pairing.result == "1-0" else pairing.white_child_id
        if winner_id in sb:
            sb[winner_id] += score_by_child.get(loser_id, 0.0)

    return sb
