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
  (`finalize_tournament_pairing`, turnuva turune gore dallanir: Arena
  Lichess'in 2/1/0 + seri katlama kurali, Isvicre klasik 1/0,5/0 olcegi
  — bkz. _apply_arena_points / _apply_swiss_points),
- siralama esitliginde kullanilan Sonneborn-Berger ("averaj") hesabi
kalir.
"""
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from chess_api.models import (
    Game, GameMove, GameType, GameStatus, Tournament, TournamentStatus, TournamentType,
    TournamentPairing, TournamentParticipant,
)
from chess_api.services.game_room import get_room

# Madde 2026-09-XX: Berserk bonusu (+1) sadece EN AZ bu kadar hamle (ply)
# oynanmışsa verilir — istismarı önlemek için (ör. berserk yapıp hemen
# rakibi terk ettirip/1 hamlede bitirip "bedava" bonus almak).
MIN_BERSERK_BONUS_MOVES = 10


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
    participant: TournamentParticipant, *, is_win: bool, is_draw: bool,
    streak_bonus: bool = True, berserk_bonus: bool = False,
) -> None:
    """Lichess Arena puanlamasi: galibiyet=2, beraberlik=1, kayip=0. "Galibiyet
    Ödülü" (streak_bonus) acikken 2 galibiyet ust uste gelince ("seri") sonraki
    HER sonuc (bu dahil) KATLANIR — maglubiyet veya galibiyet-olmayan bir sonuc
    seriyi sifirlar. Katlama, BU macin sonucundan ONCEKI seri sayisina gore
    karar verilir (Lichess ornegi: 2 galibiyet + 1 beraberlik = 2 + 2 + (2*1) =
    6 puan). streak_bonus KAPALIYSA seri yine sayilir (ileride acilirsa diye)
    ama HICBIR sonuc katlanmaz — hep duz 2/1/0.

    Madde 2026-09-10 (Berserk): berserk_bonus=True VE galibiyetse, seri
    katlamasindan SONRA, AYRI olarak +1.0 SABIT eklenir (katlanmaz) — Zafer'in
    ornegi: 2 (duz galibiyet) + 1 (berserk) = 3; seri varsa (2*2) + 1 = 5."""
    base = 2.0 if is_win else (1.0 if is_draw else 0.0)
    points = base * 2 if streak_bonus and participant.current_streak >= 2 else base
    if berserk_bonus and is_win:
        points += 1.0
    participant.current_streak = participant.current_streak + 1 if is_win else 0
    participant.score += points


def _apply_swiss_points(participant: TournamentParticipant, *, is_win: bool, is_draw: bool) -> None:
    """Madde 2026-09-XX: İsviçre KENDİ puanlama fonksiyonuna ayrıldı — klasik
    turnuva satranç ölçeği (galibiyet=1, beraberlik=0,5, kayıp=0), Arena'nın
    2/1/0 ölçeğiyle KARIŞTIRILMAZ. Seri katlaması ve Berserk zaten İsviçre'de
    hiç kullanılmıyor (Zafer'in kararı, bkz. schemas/tournament.py) — bu
    fonksiyonun onlar için parametresi bile yok. `current_streak` yine de
    sayılır (ileride açılırsa diye) ama hiçbir puana etkisi olmaz.

    OYNANMIŞ bir maç için kullanılır (galibiyet/beraberlik/kayıp) — bay için
    bkz. _apply_swiss_bye_points (farklı puan kuralı)."""
    points = 1.0 if is_win else (0.5 if is_draw else 0.0)
    participant.current_streak = participant.current_streak + 1 if is_win else 0
    participant.score += points


def _apply_swiss_bye_points(participant: TournamentParticipant, points: float) -> None:
    """Madde 2026-09-XX: bay puanı iki farklı değer alabilir (rapordaki 6.
    öneri) — services/swiss.py::_start_round çağırırken karar verir:
    - Eşleşme bulunamayana (turnuvanın başından beri orada olan, o turda
      tek sayı katılımcı bıraktığı için rakipsiz kalan biri): 1.0 TAM puan
      — gerçek bir galibiyetle AYNI, fazlası değil.
    - Turnuva başladıktan SONRA katılıp bay alana: 0,5 YARIM puan —
      istismarı önlemek için (bedava tam puan almasın diye).
    `current_streak` galibiyet gibi sayılır (tutarlılık için — İsviçre'de
    zaten hiçbir puana etkisi yok)."""
    participant.current_streak += 1
    participant.score += points


async def finalize_tournament_pairing(db: AsyncSession, game: Game) -> None:
    """Insan-insan bir mac bitince (checkmate/pat/terk/bayrak/beraberlik —
    TUMU icin TEK cagri noktasi) — eger bu mac bir turnuva eslesmesine
    baglıysa, sonucu esleme satirina yazar ve iki tarafin puanini/serisini
    gunceller: Arena Lichess kuralina gore (2/1/0 + seri + berserk), Isvicre
    klasik turnuva olcegine gore (1/0,5/0 — bkz. _apply_swiss_points).

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
    is_swiss = tournament is not None and tournament.tournament_type == TournamentType.swiss

    # Madde 2026-09-XX: Berserk bonusu SADECE yeterince hamle oynanmışsa
    # (istismarı önlemek için) — bkz. MIN_BERSERK_BONUS_MOVES.
    move_count = (await db.execute(
        select(func.count()).select_from(GameMove).where(GameMove.game_id == game.id)
    )).scalar_one()
    berserk_eligible = move_count >= MIN_BERSERK_BONUS_MOVES

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
        if is_swiss:
            _apply_swiss_points(white_p, is_win=white_wins and not is_draw, is_draw=is_draw)
        else:
            _apply_arena_points(
                white_p, is_win=white_wins and not is_draw, is_draw=is_draw,
                streak_bonus=streak_bonus, berserk_bonus=pairing.white_berserked and berserk_eligible,
            )
    if black_p is not None:
        if is_swiss:
            _apply_swiss_points(black_p, is_win=(not white_wins) and not is_draw, is_draw=is_draw)
        else:
            _apply_arena_points(
                black_p, is_win=(not white_wins) and not is_draw, is_draw=is_draw,
                streak_bonus=streak_bonus, berserk_bonus=pairing.black_berserked and berserk_eligible,
            )


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
