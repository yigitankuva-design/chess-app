"""Turnuva puanlama — Lichess Arena modeli (2026-09-05).

Eslesmeler artik bu dosyada URETILMIYOR: rakip bulma islemi
`services/arena_matchmaking.py`'deki canli kuyruga tasindi (sporcu maçini
bitirip turnuva sayfasina donunce, o anki puanina EN YAKIN bekleyen rakiple
ANINDA eslesir — sabit tur YOK). Bu dosyada:
- turnuva durum gecisi (`sync_tournament_status` — upcoming->active->finished,
  madde: mimaride arka plan cron/scheduler YOK, HER cagiran bunu lazy tetikler;
  hem routers/tournaments.py hem routers/tournament_ws.py kullanir),
- turnuva suresi dolunca hala suren maclari iptal eden
  (`_finalize_expired_games`, madde 2026-09-09 (6)),
- bir mac bitince turnuva puanini guncelleyen TEK cagri noktasi
  (`finalize_tournament_pairing`, Lichess'in 2/1/0 + seri katlama kurali),
- siralama esitliginde kullanilan Sonneborn-Berger ("averaj") hesabi
kalir.
"""
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import (
    Game, GameType, GameStatus, Tournament, TournamentStatus,
    TournamentPairing, TournamentParticipant,
)
from chess_api.services.game_room import get_room


def _ends_at(t: Tournament) -> datetime:
    return t.starts_at + timedelta(minutes=t.duration_minutes)


async def _finalize_expired_games(db: AsyncSession, tournament_id: int) -> list[int]:
    """Turnuva süresi dolunca hâlâ SÜREN eşleşmeleri iptal eder (madde 6):
    tamamlanmamış maçlar sıralamayı ETKİLEMEZ (result="void" — Sonneborn-
    Berger ve puanlama bunu görmezden gelir), oyuncuya puan/seri değişikliği
    UYGULANMAZ. İptal edilen (aborted) game_id'leri döner — çağıran bunları
    canlı odalarına 'tournament_match_cancelled' yayınlamak için kullanır."""
    pairings = (await db.execute(
        select(TournamentPairing).where(
            TournamentPairing.tournament_id == tournament_id,
            TournamentPairing.result.is_(None),
        )
    )).scalars().all()
    if not pairings:
        return []
    aborted_game_ids: list[int] = []
    for pairing in pairings:
        pairing.result = "void"
        if pairing.game_id is not None:
            game = await db.get(Game, pairing.game_id)
            if game and game.status == GameStatus.active:
                game.status = GameStatus.aborted
                game.finished_at = datetime.utcnow()
                aborted_game_ids.append(pairing.game_id)
    await db.commit()
    return aborted_game_ids


async def sync_tournament_status(db: AsyncSession, t: Tournament) -> None:
    """Lazy durum geçişi (upcoming->active->finished) — arka planda cron/
    scheduler YOK (madde: mimari kısıt). Her list/get/queue çağrısında 'now'
    ile starts_at/ends_at karşılaştırılıp gerekirse anında güncellenir.
    Turnuva TAM O ANDA (ilk kez) 'finished' olursa, hâlâ süren maçlar da
    aynı anda iptal edilip odalarına 'game_aborted' (reason=tournament_ended)
    yayınlanır — routers/live_game.py'deki first-move-timeout ile AYNI mesaj
    tipi, frontend TEK bir yerde ele alsın diye (madde 2026-09-09 (6))."""
    now = datetime.utcnow()
    changed = False
    just_finished = False
    if t.status == TournamentStatus.upcoming and now >= t.starts_at:
        t.status = TournamentStatus.active
        t.started_at = t.starts_at
        changed = True
    if t.status == TournamentStatus.active and now >= _ends_at(t):
        t.status = TournamentStatus.finished
        t.finished_at = _ends_at(t)
        changed = True
        just_finished = True
    if changed:
        await db.commit()
        await db.refresh(t)
    if just_finished:
        aborted_game_ids = await _finalize_expired_games(db, t.id)
        for game_id in aborted_game_ids:
            await get_room(game_id).broadcast({
                "type": "game_aborted", "reason": "tournament_ended",
            })


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
    FIDE/Isvicre usulu Sonneborn-Berger). Saf fonksiyon — DB'ye dokunmaz.

    `participants` ÇEKİLMİŞ (left_at dolu) sporcuları da İÇERMELİDİR — yoksa
    onları yenen/onlarla berabere kalan rakibin averajı, çekilen kişinin
    o anki (dondurulmuş) puanı yerine sessizce 0 sayılıp haksız düşer
    (madde 2026-09-09 (5)). Çağıran, GÖRÜNÜM listesinden çekilenleri ayrıca
    filtreler — bu fonksiyon hesaba dahil eder, göstermez."""
    score_by_child = {p.child_id: p.score for p in participants}
    sb: dict[int, float] = {p.child_id: 0.0 for p in participants}

    for pairing in pairings:
        # None: hâlâ sürüyor. "void": iptal edildi (15sn'de hamle yok VEYA
        # turnuva süresi doldu, madde 2/6) — ikisi de sıralamayı ETKİLEMEZ.
        if pairing.result is None or pairing.result == "void":
            continue
        if pairing.result == "1/2-1/2":
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
